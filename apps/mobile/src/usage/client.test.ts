import { describe, expect, test } from "vitest";

import { createMobileApiClient, type MobileApiFetch } from "../api/client";
import { createMobileUsageActions } from "./client";

function makeActions(payload: unknown) {
  const fetchImpl: MobileApiFetch = async () => ({
    json: async () => payload,
    ok: true,
    status: 200,
  });
  const api = createMobileApiClient(
    { apiUrl: "https://api.example.test", getCookie: async () => "session=tok" },
    fetchImpl,
  );
  return createMobileUsageActions(api);
}

const VALID_OVERVIEW = {
  ai: {
    budgetMicrounits: "5000000",
    committedMicrounits: "1250000",
    heldMicrounits: "250000",
    isDefaultBudget: true,
    keyMode: "platform",
  },
  credits: { balance: 3 },
  meters: [
    {
      cap: 10,
      description: "AI tasks started in this workspace.",
      key: "ai.requests",
      label: "AI requests",
      limit: 10,
      planLimit: 25,
      used: 4,
    },
  ],
  periodEnd: "2026-11-01T00:00:00.000Z",
  periodStart: "2026-10-01T00:00:00.000Z",
};

describe("createMobileUsageActions", () => {
  test("returns the parsed usage overview", async () => {
    const overview = await makeActions(VALID_OVERVIEW).get();
    expect(overview.ai).toEqual({
      budgetMicrounits: "5000000",
      committedMicrounits: "1250000",
      heldMicrounits: "250000",
      isDefaultBudget: true,
      keyMode: "platform",
    });
    expect(overview.meters).toEqual([
      {
        cap: 10,
        description: "AI tasks started in this workspace.",
        key: "ai.requests",
        label: "AI requests",
        limit: 10,
        planLimit: 25,
        used: 4,
      },
    ]);
    expect(overview.credits).toEqual({ balance: 3 });
    expect(overview.periodStart).toBe("2026-10-01T00:00:00.000Z");
  });

  test("keeps a null budget for BYOK workspaces", async () => {
    const overview = await makeActions({
      ...VALID_OVERVIEW,
      ai: { ...VALID_OVERVIEW.ai, budgetMicrounits: null, isDefaultBudget: false, keyMode: "byok" },
    }).get();
    expect(overview.ai.budgetMicrounits).toBeNull();
    expect(overview.ai.keyMode).toBe("byok");
  });

  test("drops malformed meter rows rather than failing the whole payload", async () => {
    const overview = await makeActions({
      ...VALID_OVERVIEW,
      meters: [
        ...VALID_OVERVIEW.meters,
        { key: "" },
        "junk",
        { key: "ok.meter", label: "ok", used: 1 },
      ],
    }).get();
    expect(overview.meters.map((meter) => meter.key)).toEqual(["ai.requests", "ok.meter"]);
  });

  test("throws when the payload shape is invalid", async () => {
    for (const payload of [
      null,
      { ai: {} },
      { ai: { committedMicrounits: 5, heldMicrounits: "0" }, credits: { balance: 1 } },
      { ai: { committedMicrounits: "0", heldMicrounits: "0", budgetMicrounits: "x" }, credits: {} },
    ]) {
      await expect(makeActions(payload).get()).rejects.toThrow("invalid");
    }
  });
});
