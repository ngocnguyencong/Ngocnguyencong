import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  deleteCalls: [] as { table: unknown }[],
  getAuthSession: vi.fn(),
  headers: vi.fn(),
  insertCalls: [] as {
    conflict?: { set: Record<string, unknown>; target: unknown };
    table: unknown;
    values: Record<string, unknown>;
  }[],
  membershipRows: [] as { role: string }[],
  recordAuditEvent: vi.fn(),
  redirect: vi.fn(),
  resolveActiveWorkspaceIdForSessionUser: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: state.headers }));
vi.mock("next/navigation", () => ({ redirect: state.redirect }));
vi.mock("./audit-runtime", () => ({ recordAuditEvent: state.recordAuditEvent }));
vi.mock("./organization-actions", () => ({
  resolveActiveWorkspaceIdForSessionUser: state.resolveActiveWorkspaceIdForSessionUser,
}));
vi.mock("./auth-runtime", () => ({
  database: {
    select() {
      return {
        from() {
          return {
            where() {
              return { limit: async () => state.membershipRows };
            },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(values: Record<string, unknown>) {
          const call: (typeof state.insertCalls)[number] = { table, values };
          return {
            onConflictDoUpdate(conflict: { set: Record<string, unknown>; target: unknown }) {
              call.conflict = conflict;
              state.insertCalls.push(call);
              return Object.assign(Promise.resolve([]), {
                returning: async () => [values],
              });
            },
          };
        },
      };
    },
    delete(table: unknown) {
      state.deleteCalls.push({ table });
      return { where: async () => {} };
    },
  },
  getAuthSession: state.getAuthSession,
}));

import { workspaceAiPolicy, workspaceUsageCap } from "@supastack/db";

import { parseAiBudgetMicrounits, parseUsageCapInput } from "./usage-input";
import { setAiMonthlyBudgetAction, setUsageCapAction } from "./usage-actions";

const here = dirname(fileURLToPath(import.meta.url));

function readWeb(relativePath: string): string {
  return readFileSync(join(here, "..", relativePath), "utf8");
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  state.deleteCalls.length = 0;
  state.insertCalls.length = 0;
  state.membershipRows = [{ role: "owner" }];
  state.headers.mockResolvedValue(new Headers());
  state.getAuthSession.mockResolvedValue({ user: { id: "user_1" } });
  state.resolveActiveWorkspaceIdForSessionUser.mockResolvedValue("ws_1");
  state.recordAuditEvent.mockResolvedValue(undefined);
  state.redirect.mockImplementation((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  });
});

describe("parseAiBudgetMicrounits", () => {
  it("converts dollar strings into bigint microunits", () => {
    expect(parseAiBudgetMicrounits("12")).toBe(12_000_000n);
    expect(parseAiBudgetMicrounits("12.50")).toBe(12_500_000n);
    expect(parseAiBudgetMicrounits("0.99")).toBe(990_000n);
    expect(parseAiBudgetMicrounits("0")).toBe(0n);
    expect(parseAiBudgetMicrounits("100000")).toBe(100_000_000_000n);
    // A single fractional digit pads to cents, not tenths-of-cents.
    expect(parseAiBudgetMicrounits("1.5")).toBe(1_500_000n);
  });

  it("rejects malformed, negative, empty, and over-max inputs", () => {
    for (const raw of ["1.234", "-1", "abc", "", "  ", "1,000", "1e3", ".5", "12.", "100001"]) {
      expect(parseAiBudgetMicrounits(raw), `input ${JSON.stringify(raw)}`).toBeNull();
    }
  });
});

describe("parseUsageCapInput", () => {
  it("clears when the value is empty or clear=1 is set", () => {
    expect(parseUsageCapInput("", "")).toEqual({ kind: "clear" });
    expect(parseUsageCapInput("  ", "")).toEqual({ kind: "clear" });
    expect(parseUsageCapInput("10", "1")).toEqual({ kind: "clear" });
  });

  it("accepts integers within the usage quota bounds", () => {
    expect(parseUsageCapInput("0", "")).toEqual({ kind: "set", cap: 0 });
    expect(parseUsageCapInput("500", "")).toEqual({ kind: "set", cap: 500 });
    expect(parseUsageCapInput("1000000000", "")).toEqual({ kind: "set", cap: 1_000_000_000 });
  });

  it("rejects non-integers, negatives, and values above MAX_USAGE_QUOTA", () => {
    for (const raw of ["1.5", "-1", "abc", "1e3", "1000000001"]) {
      expect(parseUsageCapInput(raw, ""), `input ${JSON.stringify(raw)}`).toEqual({
        kind: "invalid",
      });
    }
  });
});

describe("setAiMonthlyBudgetAction", () => {
  it("redirects signed-out callers to /auth", async () => {
    state.getAuthSession.mockResolvedValue(null);
    await expect(setAiMonthlyBudgetAction(form({ budget: "10" }))).rejects.toThrow(
      "REDIRECT:/auth",
    );
  });

  it("rejects members and guests — owner/admin only", async () => {
    for (const role of ["member", "guest"]) {
      state.membershipRows = [{ role }];
      await expect(setAiMonthlyBudgetAction(form({ budget: "10" }))).rejects.toThrow(
        "REDIRECT:/settings/usage?status=forbidden",
      );
    }
    expect(state.insertCalls).toHaveLength(0);
  });

  it("rejects malformed budgets before writing", async () => {
    await expect(setAiMonthlyBudgetAction(form({ budget: "abc" }))).rejects.toThrow(
      "REDIRECT:/settings/usage?status=invalid",
    );
    await expect(setAiMonthlyBudgetAction(form({ budget: "1.234" }))).rejects.toThrow(
      "REDIRECT:/settings/usage?status=invalid",
    );
    expect(state.insertCalls).toHaveLength(0);
  });

  it("upserts the budget in microunits and audits the change", async () => {
    await expect(setAiMonthlyBudgetAction(form({ budget: "12.50" }))).rejects.toThrow(
      "REDIRECT:/settings/usage?status=budget-saved",
    );

    expect(state.insertCalls).toHaveLength(1);
    const [call] = state.insertCalls;
    expect(call?.table).toBe(workspaceAiPolicy);
    expect(call?.values).toEqual({
      keyMode: "platform",
      monthlyBudgetMicrounits: 12_500_000n,
      workspaceId: "ws_1",
    });
    // The conflict update only rewrites the budget column — an existing BYOK
    // keyMode survives a budget save.
    expect(call?.conflict?.set).toEqual({
      monthlyBudgetMicrounits: 12_500_000n,
      updatedAt: expect.any(Date),
    });
    expect(state.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "workspace.ai_budget_updated",
        actorUserId: "user_1",
        metadata: { monthlyBudgetMicrounits: "12500000" },
        workspaceId: "ws_1",
      }),
    );
  });

  it("reset=1 stores NULL — restoring the default or BYOK-unlimited budget", async () => {
    await expect(setAiMonthlyBudgetAction(form({ reset: "1" }))).rejects.toThrow(
      "REDIRECT:/settings/usage?status=budget-saved",
    );
    expect(state.insertCalls[0]?.values).toMatchObject({ monthlyBudgetMicrounits: null });
  });
});

describe("setUsageCapAction", () => {
  it("rejects non-manager roles", async () => {
    state.membershipRows = [{ role: "member" }];
    await expect(setUsageCapAction(form({ key: "ai.requests", cap: "10" }))).rejects.toThrow(
      "REDIRECT:/settings/usage?status=forbidden",
    );
    expect(state.insertCalls).toHaveLength(0);
    expect(state.deleteCalls).toHaveLength(0);
  });

  it("rejects keys outside the usage meter catalog", async () => {
    await expect(setUsageCapAction(form({ key: "unknown.meter", cap: "10" }))).rejects.toThrow(
      "REDIRECT:/settings/usage?status=invalid",
    );
    expect(state.insertCalls).toHaveLength(0);
  });

  it("rejects non-integer and out-of-range caps", async () => {
    for (const cap of ["1.5", "abc", "-1", "1000000001"]) {
      await expect(setUsageCapAction(form({ key: "ai.requests", cap }))).rejects.toThrow(
        "REDIRECT:/settings/usage?status=invalid",
      );
    }
    expect(state.insertCalls).toHaveLength(0);
  });

  it("sets the cap and audits the change", async () => {
    await expect(setUsageCapAction(form({ key: "ai.requests", cap: "10" }))).rejects.toThrow(
      "REDIRECT:/settings/usage?status=cap-saved",
    );
    expect(state.insertCalls).toHaveLength(1);
    const [call] = state.insertCalls;
    expect(call?.table).toBe(workspaceUsageCap);
    expect(call?.values).toEqual({ cap: 10, key: "ai.requests", workspaceId: "ws_1" });
    expect(state.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "workspace.usage_cap_updated",
        metadata: { cap: 10, key: "ai.requests" },
        workspaceId: "ws_1",
      }),
    );
  });

  it("clears the cap on clear=1 or an empty value", async () => {
    await expect(
      setUsageCapAction(form({ key: "ai.requests", clear: "1", cap: "10" })),
    ).rejects.toThrow("REDIRECT:/settings/usage?status=cap-cleared");
    await expect(setUsageCapAction(form({ key: "ai.requests", cap: "" }))).rejects.toThrow(
      "REDIRECT:/settings/usage?status=cap-cleared",
    );
    expect(state.deleteCalls).toHaveLength(2);
    expect(state.deleteCalls[0]?.table).toBe(workspaceUsageCap);
  });
});

describe("usage settings actions source", () => {
  it("keeps the role gate and redirect vocabulary in place", () => {
    const source = readWeb("src/usage-actions.ts");
    expect(source).toContain("canManageWorkspaceMembers");
    expect(source).toContain("resolveActiveWorkspaceIdForSessionUser");
    expect(source).toContain("USAGE_METERS.some");
    expect(source).toContain("AUDIT_ACTIONS.workspaceAiBudgetUpdated");
    expect(source).toContain("AUDIT_ACTIONS.workspaceUsageCapUpdated");
  });
});
