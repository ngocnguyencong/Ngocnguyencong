import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./auth-runtime", () => ({ database: {} }));

import { getWorkspaceUsageOverview, type UsageOverviewDependencies } from "./usage-overview";

function deps(overrides: Partial<UsageOverviewDependencies> = {}): UsageOverviewDependencies {
  return {
    readAiPolicy: async () => undefined,
    readAiSpend: async () => ({ committedMicrounits: 0n, heldMicrounits: 0n }),
    getCreditBalance: async () => 0,
    caps: { get: async () => null },
    listActiveEntitlementKeys: async () => [],
    repository: {
      consume: async () => ({ ok: true as const, used: 0, limit: null }),
      get: async () => ({ used: 0 }),
      list: async () => [],
    },
    ...overrides,
  };
}

const NOW = new Date("2026-10-24T15:30:00.000Z");

describe("getWorkspaceUsageOverview", () => {
  it("serializes the UTC month window and bigint amounts as decimal strings", async () => {
    const overview = await getWorkspaceUsageOverview(
      "ws_1",
      NOW,
      deps({
        readAiSpend: async (workspaceId, periodStart) => {
          expect(workspaceId).toBe("ws_1");
          expect(periodStart.toISOString()).toBe("2026-10-01T00:00:00.000Z");
          return { committedMicrounits: 1_250_000n, heldMicrounits: 250_000n };
        },
      }),
    );

    expect(overview.periodStart).toBe("2026-10-01T00:00:00.000Z");
    expect(overview.periodEnd).toBe("2026-11-01T00:00:00.000Z");
    expect(overview.ai.committedMicrounits).toBe("1250000");
    expect(overview.ai.heldMicrounits).toBe("250000");
  });

  it("reports the platform default budget when no policy row exists", async () => {
    const overview = await getWorkspaceUsageOverview("ws_1", NOW, deps());
    expect(overview.ai).toMatchObject({
      keyMode: "platform",
      budgetMicrounits: "5000000",
      isDefaultBudget: true,
    });
  });

  it("reports an explicit budget as non-default", async () => {
    const overview = await getWorkspaceUsageOverview(
      "ws_1",
      NOW,
      deps({
        readAiPolicy: async () => ({
          keyMode: "platform",
          monthlyBudgetMicrounits: 12_500_000n,
        }),
      }),
    );
    expect(overview.ai).toMatchObject({
      budgetMicrounits: "12500000",
      isDefaultBudget: false,
    });
  });

  it("reports a null, non-default budget for BYOK workspaces", async () => {
    const overview = await getWorkspaceUsageOverview(
      "ws_1",
      NOW,
      deps({
        readAiPolicy: async () => ({ keyMode: "byok", monthlyBudgetMicrounits: null }),
      }),
    );
    expect(overview.ai).toMatchObject({
      keyMode: "byok",
      budgetMicrounits: null,
      isDefaultBudget: false,
    });
  });

  it("returns per-meter usage with plan limits, caps, and the effective limit", async () => {
    const overview = await getWorkspaceUsageOverview(
      "ws_1",
      NOW,
      deps({
        caps: { get: async () => 10 },
        plans: [
          {
            blurb: "",
            checkout: "none",
            entitlement: null,
            id: "free",
            interval: "none",
            name: "Free",
            priceLabel: "$0",
            seatsIncluded: 1,
            trialDays: null,
            usageLimits: { "ai.requests": 25 },
          },
        ],
        repository: {
          consume: async () => ({ ok: true as const, used: 0, limit: null }),
          get: async () => ({ used: 7 }),
          list: async () => [],
        },
      }),
    );

    expect(overview.meters).toEqual([
      {
        key: "ai.requests",
        label: "AI requests",
        description: "AI tasks started in this workspace.",
        used: 7,
        planLimit: 25,
        cap: 10,
        limit: 10,
      },
    ]);
  });

  it("reports the prepaid credit balance", async () => {
    const overview = await getWorkspaceUsageOverview(
      "ws_1",
      NOW,
      deps({ getCreditBalance: async () => 17 }),
    );
    expect(overview.credits).toEqual({ balance: 17 });
  });
});
