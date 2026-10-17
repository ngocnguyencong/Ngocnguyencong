import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getWorkspaceCredits: vi.fn(),
  listTransactions: vi.fn(),
  resolveScope: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("./auth-runtime", () => ({ getAuthSession: mocks.getSession }));
vi.mock("./chat-api", () => ({ resolveChatScope: mocks.resolveScope }));
vi.mock("./credits", () => ({
  getWorkspaceCredits: mocks.getWorkspaceCredits,
  listWorkspaceCreditTransactions: mocks.listTransactions,
}));

import { GET } from "../app/api/workspace/credits/route";

describe("GET /api/workspace/credits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: "user_a" } });
    mocks.resolveScope.mockResolvedValue({ userId: "user_a", workspaceId: "ws_1" });
    mocks.getWorkspaceCredits.mockResolvedValue(42);
    mocks.listTransactions.mockResolvedValue([
      {
        actorUserId: "admin_1",
        amount: 25,
        balanceAfter: 42,
        createdAt: new Date("2026-10-01T12:00:00.000Z"),
        id: "ctxn_1",
        kind: "grant",
        reason: "plan credit grant",
        referenceId: "plan-credit:stripe:sub_1",
        workspaceId: "ws_1",
      },
    ]);
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getSession.mockResolvedValue(null);
    const response = await GET(new Request("https://app.test/api/workspace/credits"));
    expect(response.status).toBe(401);
    expect(mocks.resolveScope).not.toHaveBeenCalled();
    expect(mocks.getWorkspaceCredits).not.toHaveBeenCalled();
  });

  it("returns 403 when the user has no workspace scope", async () => {
    mocks.resolveScope.mockResolvedValue(null);
    const response = await GET(new Request("https://app.test/api/workspace/credits"));
    expect(response.status).toBe(403);
    expect(mocks.getWorkspaceCredits).not.toHaveBeenCalled();
  });

  it("returns the balance and a serialized ledger projection", async () => {
    const response = await GET(new Request("https://app.test/api/workspace/credits"));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      balance: 42,
      transactions: [
        {
          amount: 25,
          balanceAfter: 42,
          createdAt: "2026-10-01T12:00:00.000Z",
          id: "ctxn_1",
          kind: "grant",
          reason: "plan credit grant",
        },
      ],
    });
    // The ledger stays workspace-scoped: helpers are called with the
    // resolved scope's workspace. actorUserId and referenceId stay
    // server-side — grant references embed provider subscription ids.
    expect(mocks.getWorkspaceCredits).toHaveBeenCalledWith("ws_1");
    expect(mocks.listTransactions).toHaveBeenCalledWith("ws_1", 50);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("admin_1");
    expect(serialized).not.toContain("plan-credit");
  });
});
