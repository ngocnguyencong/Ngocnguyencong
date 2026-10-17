import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ overview: vi.fn(), resolve: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./auth-runtime", () => ({
  getAuthSession: async () => ({ user: { id: "user_a" } }),
}));
vi.mock("./mobile-workspace-context", () => ({ resolveMobileWorkspaceContext: mocks.resolve }));
vi.mock("./usage-overview", () => ({ getWorkspaceUsageOverview: mocks.overview }));

import { GET } from "../app/api/mobile/usage/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolve.mockResolvedValue({
    role: "owner",
    userId: "user_a",
    workspaceId: "ws_1",
    workspaceName: "Org",
    workspaceType: "organization",
  });
  mocks.overview.mockResolvedValue({
    ai: {
      budgetMicrounits: "5000000",
      committedMicrounits: "1250000",
      heldMicrounits: "0",
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
  });
});

describe("GET /api/mobile/usage", () => {
  it("returns the workspace usage overview for the resolved workspace", async () => {
    const response = await GET(new Request("https://app.test/api/mobile/usage"));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.periodStart).toBe("2026-10-01T00:00:00.000Z");
    expect(payload.ai.budgetMicrounits).toBe("5000000");
    expect(payload.meters[0]).toMatchObject({ key: "ai.requests", cap: 10, used: 4 });
    expect(payload.credits).toEqual({ balance: 3 });
    expect(mocks.resolve).toHaveBeenCalledWith("user_a");
    expect(mocks.overview).toHaveBeenCalledWith("ws_1", expect.any(Date));
  });

  it("returns 403 when the user has no active workspace", async () => {
    mocks.resolve.mockResolvedValue(null);
    const response = await GET(new Request("https://app.test/api/mobile/usage"));
    expect(response.status).toBe(403);
    expect(mocks.overview).not.toHaveBeenCalled();
  });
});
