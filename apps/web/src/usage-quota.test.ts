import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// The default repos only run when a dep isn't injected; an empty select
// chain keeps them inert (no entitlement rows, no stored caps).
vi.mock("./auth-runtime", () => ({
  database: {
    select() {
      return {
        from() {
          return {
            where() {
              return Object.assign(Promise.resolve([] as unknown[]), {
                limit: () => Promise.resolve([]),
              });
            },
          };
        },
      };
    },
  },
}));

import type {
  AppendCreditTransactionInput,
  ConsumeUsageCounterInput,
  ConsumeUsageCounterResult,
  CreditTransaction,
  CreditsRepository,
  GetUsageCounterInput,
  UsageCounterRepository,
} from "@supastack/db";
import { InsufficientCreditsError } from "@supastack/db";

import type { ProductPlan } from "./product-plans";
import {
  consumeQuota,
  getQuota,
  monthStart,
  resolveEffectiveUsageLimit,
  resolveUsageLimit,
  resolveWorkspacePlan,
  type UsageQuotaDependencies,
} from "./usage-quota";

function plan(overrides: Partial<ProductPlan> & Pick<ProductPlan, "id">): ProductPlan {
  return Object.freeze({
    blurb: "",
    checkout: "none",
    entitlement: null,
    interval: "none",
    name: overrides.id,
    priceLabel: "$0",
    seatsIncluded: 1,
    trialDays: null,
    ...overrides,
  });
}

const FREE = plan({ id: "free", usageLimits: { "ai.requests": 25 } });
const PAID = plan({
  checkout: "stripe",
  entitlement: "paid.access",
  id: "pro",
  usageLimits: { "ai.requests": 500 },
});

const PERIOD = new Date("2026-09-01T00:00:00.000Z");

function stubEntitlements(keys: readonly string[]) {
  return vi.fn(async () => keys);
}

function createFakeRepository(overrides?: {
  consumeResult?: ConsumeUsageCounterResult;
  getUsed?: number;
}) {
  const calls = {
    consume: [] as ConsumeUsageCounterInput[],
    get: [] as GetUsageCounterInput[],
  };
  const repository: UsageCounterRepository = {
    async consume(input) {
      calls.consume.push(input);
      return overrides?.consumeResult ?? { ok: true, used: input.n, limit: input.limit };
    },
    async get(input) {
      calls.get.push(input);
      return { used: overrides?.getUsed ?? 0 };
    },
    async list() {
      return [];
    },
  };
  return { calls, repository };
}

function createFakeCredits(overrides?: {
  balance?: number;
  fail?: "insufficient" | "error" | "conflict";
}) {
  const calls = { append: [] as AppendCreditTransactionInput[] };
  const repository: CreditsRepository = {
    async appendTransaction(input) {
      calls.append.push(input);
      if (overrides?.fail === "insufficient") {
        throw new InsufficientCreditsError(input.workspaceId);
      }
      if (overrides?.fail === "error") {
        throw new Error("ledger unavailable");
      }
      if (overrides?.fail === "conflict") {
        throw Object.assign(new Error("duplicate key value violates unique constraint"), {
          code: "23505",
          constraint_name: "uq_credit_transaction_reference",
        });
      }
      return { balance: overrides?.balance ?? 4 };
    },
    async getBalance() {
      return overrides?.balance ?? 4;
    },
    async hasTransactionWithReference() {
      return false;
    },
    async listTransactions() {
      return [] as CreditTransaction[];
    },
  };
  return { calls, repository };
}

function createFakeCaps(values: Record<string, number> = {}) {
  const calls = { get: [] as { key: string; workspaceId: string }[] };
  const caps: UsageQuotaDependencies["caps"] = {
    async get(workspaceId, key) {
      calls.get.push({ key, workspaceId });
      return values[key] ?? null;
    },
  };
  return { calls, caps };
}

describe("monthStart", () => {
  it("returns the first instant of the UTC calendar month", () => {
    expect(monthStart(new Date("2026-09-24T15:30:45.123Z")).toISOString()).toBe(
      "2026-09-01T00:00:00.000Z",
    );
    expect(monthStart(new Date("2026-12-31T23:59:59.999Z")).toISOString()).toBe(
      "2026-12-01T00:00:00.000Z",
    );
    expect(monthStart(new Date("2027-01-01T00:00:00.000Z")).toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );
    // UTC semantics — a local-time month boundary can't leak in.
    expect(monthStart(new Date("2026-09-30T23:30:00.000Z")).toISOString()).toBe(
      "2026-09-01T00:00:00.000Z",
    );
  });
});

describe("resolveWorkspacePlan", () => {
  it("falls back to the free plan when nothing is granted", () => {
    expect(resolveWorkspacePlan([])?.id).toBe("free");
    expect(resolveWorkspacePlan(["unrelated.key"])?.id).toBe("free");
  });

  it("resolves the first catalog plan whose entitlement is granted", () => {
    // Kit's pro + lifetime share the "ai.reference-task" entitlement — the
    // earlier catalog entry wins (pro precedes lifetime).
    expect(resolveWorkspacePlan(["ai.reference-task"])?.id).toBe("pro");
    expect(resolveWorkspacePlan(["paid.access"], [FREE, PAID])?.id).toBe("pro");
  });

  it("returns null when no plan matches and the catalog has no free plan", () => {
    expect(resolveWorkspacePlan([], [PAID])).toBeNull();
    expect(resolveWorkspacePlan([], [])).toBeNull();
  });
});

describe("resolveUsageLimit", () => {
  it("reads the resolved plan's usageLimits entry", async () => {
    const dependencies = {
      listActiveEntitlementKeys: stubEntitlements(["paid.access"]),
      plans: [FREE, PAID],
    };

    await expect(resolveUsageLimit("ws_1", "ai.requests", dependencies)).resolves.toBe(500);
    // A key the plan doesn't meter is unlimited.
    await expect(resolveUsageLimit("ws_1", "other.meter", dependencies)).resolves.toBeNull();
  });

  it("uses the free plan's limits when no entitlement is active", async () => {
    await expect(
      resolveUsageLimit("ws_1", "ai.requests", {
        listActiveEntitlementKeys: stubEntitlements([]),
        plans: [FREE, PAID],
      }),
    ).resolves.toBe(25);
  });

  it("treats plans without usageLimits — and non-number values — as unlimited", async () => {
    const noLimits = plan({ entitlement: "paid.access", id: "pro" });
    await expect(
      resolveUsageLimit("ws_1", "ai.requests", {
        listActiveEntitlementKeys: stubEntitlements(["paid.access"]),
        plans: [FREE, noLimits],
      }),
    ).resolves.toBeNull();

    const malformed = plan({
      entitlement: "paid.access",
      id: "pro",
      usageLimits: { "ai.requests": "500" as never },
    });
    await expect(
      resolveUsageLimit("ws_1", "ai.requests", {
        listActiveEntitlementKeys: stubEntitlements(["paid.access"]),
        plans: [FREE, malformed],
      }),
    ).resolves.toBeNull();
  });

  it("defaults to the kit catalog — unlimited for every meter", async () => {
    await expect(
      resolveUsageLimit("ws_1", "ai.requests", {
        listActiveEntitlementKeys: stubEntitlements(["ai.reference-task"]),
      }),
    ).resolves.toBeNull();
  });

  it("validates workspace and key before querying entitlements", async () => {
    const listActiveEntitlementKeys = stubEntitlements([]);
    await expect(resolveUsageLimit("", "k", { listActiveEntitlementKeys })).rejects.toThrow();
    await expect(resolveUsageLimit("ws_1", "", { listActiveEntitlementKeys })).rejects.toThrow();
    await expect(
      resolveUsageLimit("ws_1", "k".repeat(101), { listActiveEntitlementKeys }),
    ).rejects.toThrow();
    expect(listActiveEntitlementKeys).not.toHaveBeenCalled();
  });
});

describe("consumeQuota", () => {
  it("resolves the plan limit and forwards the atomic consume", async () => {
    const { calls, repository } = createFakeRepository();
    const result = await consumeQuota(
      { key: "ai.requests", n: 3, workspaceId: "ws_1" },
      {
        listActiveEntitlementKeys: stubEntitlements(["paid.access"]),
        now: () => new Date("2026-09-24T12:00:00.000Z"),
        plans: [FREE, PAID],
        repository,
      },
    );

    expect(result).toEqual({ ok: true, used: 3, limit: 500 });
    expect(calls.consume).toEqual([
      {
        key: "ai.requests",
        limit: 500,
        n: 3,
        periodStart: new Date("2026-09-01T00:00:00.000Z"),
        workspaceId: "ws_1",
      },
    ]);
  });

  it("passes an explicit periodStart through and propagates rejections", async () => {
    const { calls, repository } = createFakeRepository({
      consumeResult: { ok: false, reason: "quota_exhausted", used: 25, limit: 25 },
    });

    const result = await consumeQuota(
      { key: "ai.requests", n: 1, periodStart: PERIOD, workspaceId: "ws_1" },
      {
        // An empty prepaid pool leaves the rejection intact.
        credits: createFakeCredits({ fail: "insufficient" }).repository,
        listActiveEntitlementKeys: stubEntitlements([]),
        plans: [FREE, PAID],
        repository,
      },
    );

    expect(result).toEqual({ ok: false, reason: "quota_exhausted", used: 25, limit: 25 });
    expect(calls.consume[0]).toMatchObject({ limit: 25, periodStart: PERIOD });
  });

  it("falls back to a prepaid credit debit when the plan quota is exhausted", async () => {
    const { repository } = createFakeRepository({
      consumeResult: { ok: false, reason: "quota_exhausted", used: 25, limit: 25 },
    });
    const credits = createFakeCredits({ balance: 4 });

    const result = await consumeQuota(
      { key: "ai.requests", n: 1, referenceId: "task_1", workspaceId: "ws_1" },
      {
        credits: credits.repository,
        listActiveEntitlementKeys: stubEntitlements([]),
        plans: [FREE, PAID],
        repository,
      },
    );

    expect(result).toEqual({ ok: true, used: 25, limit: 25 });
    expect(credits.calls.append).toEqual([
      {
        amount: -1,
        kind: "debit",
        reason: "usage quota overflow",
        referenceId: "task_1",
        workspaceId: "ws_1",
      },
    ]);
  });

  it("debits one credit per consumed unit when quota overflows", async () => {
    const { repository } = createFakeRepository({
      consumeResult: { ok: false, reason: "quota_exhausted", used: 24, limit: 25 },
    });
    const credits = createFakeCredits({ balance: 8 });

    const result = await consumeQuota(
      { key: "ai.requests", n: 3, workspaceId: "ws_1" },
      {
        credits: credits.repository,
        listActiveEntitlementKeys: stubEntitlements([]),
        plans: [FREE, PAID],
        repository,
      },
    );

    expect(result).toEqual({ ok: true, used: 24, limit: 25 });
    expect(credits.calls.append[0]).toMatchObject({ amount: -3, kind: "debit" });
  });

  it("keeps the quota rejection when the credit balance cannot cover the overflow", async () => {
    const { repository } = createFakeRepository({
      consumeResult: { ok: false, reason: "quota_exhausted", used: 25, limit: 25 },
    });
    const credits = createFakeCredits({ fail: "insufficient" });

    const result = await consumeQuota(
      { key: "ai.requests", n: 1, workspaceId: "ws_1" },
      {
        credits: credits.repository,
        listActiveEntitlementKeys: stubEntitlements([]),
        plans: [FREE, PAID],
        repository,
      },
    );

    expect(result).toEqual({ ok: false, reason: "quota_exhausted", used: 25, limit: 25 });
    expect(credits.calls.append).toHaveLength(1);
  });

  it("propagates unexpected ledger failures instead of masking them as quota rejections", async () => {
    const { repository } = createFakeRepository({
      consumeResult: { ok: false, reason: "quota_exhausted", used: 25, limit: 25 },
    });
    const credits = createFakeCredits({ fail: "error" });

    await expect(
      consumeQuota(
        { key: "ai.requests", n: 1, workspaceId: "ws_1" },
        {
          credits: credits.repository,
          listActiveEntitlementKeys: stubEntitlements([]),
          plans: [FREE, PAID],
          repository,
        },
      ),
    ).rejects.toThrow("ledger unavailable");
  });

  it("treats a raced twin debit on the same reference as already paid", async () => {
    const { repository } = createFakeRepository({
      consumeResult: { ok: false, reason: "quota_exhausted", used: 25, limit: 25 },
    });
    const credits = createFakeCredits({ fail: "conflict" });

    const result = await consumeQuota(
      { key: "ai.requests", n: 1, referenceId: "task_1", workspaceId: "ws_1" },
      {
        credits: credits.repository,
        listActiveEntitlementKeys: stubEntitlements([]),
        plans: [FREE, PAID],
        repository,
      },
    );

    // The twin intake already charged this reference — report the overflow as
    // covered so the loser resolves through the normal replay path.
    expect(result).toEqual({ ok: true, used: 25, limit: 25 });
  });

  it("propagates reference conflicts that carry no reference id", async () => {
    const { repository } = createFakeRepository({
      consumeResult: { ok: false, reason: "quota_exhausted", used: 25, limit: 25 },
    });
    const credits = createFakeCredits({ fail: "conflict" });

    await expect(
      consumeQuota(
        { key: "ai.requests", n: 1, workspaceId: "ws_1" },
        {
          credits: credits.repository,
          listActiveEntitlementKeys: stubEntitlements([]),
          plans: [FREE, PAID],
          repository,
        },
      ),
    ).rejects.toThrow("duplicate key value");
  });

  it("never touches the credit ledger when no plan limit is configured (unlimited)", async () => {
    const { repository } = createFakeRepository();
    const credits = createFakeCredits();

    const result = await consumeQuota(
      { key: "ai.requests", n: 1, workspaceId: "ws_1" },
      {
        credits: credits.repository,
        listActiveEntitlementKeys: stubEntitlements(["ai.reference-task"]),
        repository,
        // Kit catalog ships no usageLimits → the meter resolves unlimited.
      },
    );

    expect(result).toEqual({ ok: true, used: 1, limit: null });
    expect(credits.calls.append).toHaveLength(0);
  });

  it("passes the cap through as the effective limit when it is below the plan limit", async () => {
    const { calls, repository } = createFakeRepository();
    const { caps } = createFakeCaps({ "ai.requests": 10 });

    const result = await consumeQuota(
      { key: "ai.requests", n: 2, workspaceId: "ws_1" },
      {
        caps,
        listActiveEntitlementKeys: stubEntitlements([]),
        plans: [FREE, PAID],
        repository,
      },
    );

    expect(result).toEqual({ ok: true, used: 2, limit: 10 });
    expect(calls.consume[0]).toMatchObject({ limit: 10 });
  });

  it("enforces the cap on an unlimited plan — and never touches credits when it binds", async () => {
    const { calls, repository } = createFakeRepository({
      consumeResult: { ok: false, reason: "quota_exhausted", used: 10, limit: 10 },
    });
    const credits = createFakeCredits({ balance: 4 });
    const { caps } = createFakeCaps({ "ai.requests": 10 });

    const result = await consumeQuota(
      { key: "ai.requests", n: 1, workspaceId: "ws_1" },
      {
        caps,
        credits: credits.repository,
        listActiveEntitlementKeys: stubEntitlements([]),
        // Kit catalog ships no usageLimits → plan resolves unlimited; the
        // owner cap is the only limit and it is a hard ceiling.
        repository,
      },
    );

    expect(result).toEqual({ ok: false, reason: "quota_exhausted", used: 10, limit: 10 });
    expect(calls.consume[0]).toMatchObject({ limit: 10 });
    expect(credits.calls.append).toHaveLength(0);
  });

  it("skips the credit overflow when a cap below the plan limit binds", async () => {
    const { repository } = createFakeRepository({
      consumeResult: { ok: false, reason: "quota_exhausted", used: 10, limit: 10 },
    });
    const credits = createFakeCredits({ balance: 4 });
    const { caps } = createFakeCaps({ "ai.requests": 10 });

    const result = await consumeQuota(
      { key: "ai.requests", n: 1, referenceId: "task_1", workspaceId: "ws_1" },
      {
        caps,
        credits: credits.repository,
        listActiveEntitlementKeys: stubEntitlements([]),
        plans: [FREE, PAID], // plan limit 25 > cap 10 → the cap binds
        repository,
      },
    );

    expect(result).toEqual({ ok: false, reason: "quota_exhausted", used: 10, limit: 10 });
    expect(credits.calls.append).toHaveLength(0);
  });

  it("keeps the credit overflow when the plan limit binds at or below the cap", async () => {
    const { repository } = createFakeRepository({
      consumeResult: { ok: false, reason: "quota_exhausted", used: 25, limit: 25 },
    });
    const credits = createFakeCredits({ balance: 4 });
    // cap (100) >= planLimit (25) → the plan binds and credits cover overflow.
    const { caps } = createFakeCaps({ "ai.requests": 100 });

    const result = await consumeQuota(
      { key: "ai.requests", n: 1, referenceId: "task_1", workspaceId: "ws_1" },
      {
        caps,
        credits: credits.repository,
        listActiveEntitlementKeys: stubEntitlements([]),
        plans: [FREE, PAID],
        repository,
      },
    );

    expect(result).toEqual({ ok: true, used: 25, limit: 25 });
    expect(credits.calls.append).toEqual([
      {
        amount: -1,
        kind: "debit",
        reason: "usage quota overflow",
        referenceId: "task_1",
        workspaceId: "ws_1",
      },
    ]);
  });

  it("treats a cap equal to the plan limit as plan-binding for credit overflow", async () => {
    const { repository } = createFakeRepository({
      consumeResult: { ok: false, reason: "quota_exhausted", used: 25, limit: 25 },
    });
    const credits = createFakeCredits({ balance: 4 });
    const { caps } = createFakeCaps({ "ai.requests": 25 });

    const result = await consumeQuota(
      { key: "ai.requests", n: 1, workspaceId: "ws_1" },
      {
        caps,
        credits: credits.repository,
        listActiveEntitlementKeys: stubEntitlements([]),
        plans: [FREE, PAID],
        repository,
      },
    );

    expect(result).toEqual({ ok: true, used: 25, limit: 25 });
    expect(credits.calls.append).toHaveLength(1);
  });

  it("never touches the credit ledger while plan quota still fits", async () => {
    const { repository } = createFakeRepository();
    const credits = createFakeCredits();

    const result = await consumeQuota(
      { key: "ai.requests", n: 2, workspaceId: "ws_1" },
      {
        credits: credits.repository,
        listActiveEntitlementKeys: stubEntitlements([]),
        plans: [FREE, PAID],
        repository,
      },
    );

    expect(result).toEqual({ ok: true, used: 2, limit: 25 });
    expect(credits.calls.append).toHaveLength(0);
  });

  it("validates referenceId before resolving anything", async () => {
    const { calls, repository } = createFakeRepository();
    const listActiveEntitlementKeys = stubEntitlements([]);
    const dependencies = { listActiveEntitlementKeys, plans: [FREE], repository };

    await expect(
      consumeQuota(
        { key: "k", n: 1, referenceId: "r".repeat(129), workspaceId: "ws_1" },
        dependencies,
      ),
    ).rejects.toThrow();

    expect(listActiveEntitlementKeys).not.toHaveBeenCalled();
    expect(calls.consume).toHaveLength(0);
  });

  it("validates n and periodStart before resolving anything", async () => {
    const { calls, repository } = createFakeRepository();
    const listActiveEntitlementKeys = stubEntitlements([]);
    const dependencies = { listActiveEntitlementKeys, plans: [FREE], repository };

    for (const n of [0, -2, 1.5, Number.NaN]) {
      await expect(
        consumeQuota({ key: "k", n, workspaceId: "ws_1" }, dependencies),
      ).rejects.toThrow();
    }
    await expect(
      consumeQuota(
        { key: "k", n: 1, periodStart: new Date("bad"), workspaceId: "ws_1" },
        dependencies,
      ),
    ).rejects.toThrow();

    expect(listActiveEntitlementKeys).not.toHaveBeenCalled();
    expect(calls.consume).toHaveLength(0);
  });
});

describe("resolveEffectiveUsageLimit", () => {
  it("returns the lower of the plan limit and the workspace cap", async () => {
    const { caps } = createFakeCaps({ "ai.requests": 10 });
    await expect(
      resolveEffectiveUsageLimit("ws_1", "ai.requests", {
        caps,
        listActiveEntitlementKeys: stubEntitlements([]),
        plans: [FREE, PAID],
      }),
    ).resolves.toBe(10);

    const { caps: highCaps } = createFakeCaps({ "ai.requests": 500 });
    await expect(
      resolveEffectiveUsageLimit("ws_1", "ai.requests", {
        caps: highCaps,
        listActiveEntitlementKeys: stubEntitlements([]),
        plans: [FREE, PAID],
      }),
    ).resolves.toBe(25);
  });

  it("returns the cap when the plan is unlimited, and null when neither is set", async () => {
    const { caps } = createFakeCaps({ "ai.requests": 10 });
    await expect(
      resolveEffectiveUsageLimit("ws_1", "ai.requests", {
        caps,
        listActiveEntitlementKeys: stubEntitlements([]),
      }),
    ).resolves.toBe(10);

    await expect(
      resolveEffectiveUsageLimit("ws_1", "ai.requests", {
        caps: createFakeCaps().caps,
        listActiveEntitlementKeys: stubEntitlements([]),
      }),
    ).resolves.toBeNull();
  });
});

describe("getQuota", () => {
  it("returns the stored usage and resolved limit for the period", async () => {
    const { repository } = createFakeRepository({ getUsed: 9 });
    await expect(
      getQuota(
        { key: "ai.requests", periodStart: PERIOD, workspaceId: "ws_1" },
        {
          listActiveEntitlementKeys: stubEntitlements(["paid.access"]),
          plans: [FREE, PAID],
          repository,
        },
      ),
    ).resolves.toEqual({ used: 9, limit: 500, planLimit: 500, cap: null });
  });

  it("reports the plan limit, the cap, and the effective limit separately", async () => {
    const { repository } = createFakeRepository({ getUsed: 9 });
    const { caps } = createFakeCaps({ "ai.requests": 10 });
    await expect(
      getQuota(
        { key: "ai.requests", periodStart: PERIOD, workspaceId: "ws_1" },
        {
          caps,
          listActiveEntitlementKeys: stubEntitlements(["paid.access"]),
          plans: [FREE, PAID],
          repository,
        },
      ),
    ).resolves.toEqual({ used: 9, limit: 10, planLimit: 500, cap: 10 });
  });

  it("reports unlimited when neither the plan nor a cap limits the meter", async () => {
    const { repository } = createFakeRepository({ getUsed: 3 });
    await expect(
      getQuota(
        { key: "ai.requests", periodStart: PERIOD, workspaceId: "ws_1" },
        {
          caps: createFakeCaps().caps,
          listActiveEntitlementKeys: stubEntitlements([]),
          repository,
        },
      ),
    ).resolves.toEqual({ used: 3, limit: null, planLimit: null, cap: null });
  });

  it("defaults the period to the current UTC month", async () => {
    const { calls, repository } = createFakeRepository({ getUsed: 0 });
    await getQuota(
      { key: "ai.requests", workspaceId: "ws_1" },
      {
        listActiveEntitlementKeys: stubEntitlements([]),
        now: () => new Date("2026-03-15T08:00:00.000Z"),
        plans: [FREE],
        repository,
      },
    );
    expect(calls.get[0]).toMatchObject({
      periodStart: new Date("2026-03-01T00:00:00.000Z"),
    });
  });
});
