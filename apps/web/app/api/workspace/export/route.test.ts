import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  audit: vi.fn(async () => {}),
  buildExport: vi.fn(),
  limiter: vi.fn(async () => null as Response | null),
  membershipLimit: vi.fn(async () => [{ role: "owner" }]),
  session: { user: { id: "user_1" } } as { user: { id: string } } | null,
  workspaceId: "ws_1" as string | undefined,
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));
vi.mock("../../../../src/auth-runtime", () => ({
  database: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: dependencies.membershipLimit }),
      }),
    }),
  },
  getAuthSession: async () => dependencies.session,
}));
vi.mock("../../../../src/organization-actions", () => ({
  resolveActiveWorkspaceIdForSessionUser: async () => dependencies.workspaceId,
}));
vi.mock("../../../../src/audit-runtime", () => ({
  recordAuditEvent: dependencies.audit,
}));
vi.mock("../../../../src/rate-limit-route", () => ({
  rateLimitResponse: dependencies.limiter,
}));
vi.mock("../../../../src/rate-limit-runtime", () => ({
  exportDownloadLimiter: { check: vi.fn() },
}));
vi.mock("../../../../src/workspace-export", () => ({
  buildWorkspaceExport: dependencies.buildExport,
}));

import { GET } from "./route";

const exportFixture = {
  format: "supastack.workspace-export",
  version: 1,
  workspace: { id: "ws_1", name: "Acme", slug: "acme" },
};

beforeEach(() => {
  dependencies.session = { user: { id: "user_1" } };
  dependencies.workspaceId = "ws_1";
  dependencies.membershipLimit.mockReset().mockResolvedValue([{ role: "owner" }]);
  dependencies.audit.mockClear();
  dependencies.limiter.mockReset().mockResolvedValue(null);
  dependencies.buildExport.mockReset().mockResolvedValue(exportFixture);
});

describe("GET /api/workspace/export", () => {
  it("returns 401 when unauthenticated", async () => {
    dependencies.session = null;
    const response = await GET();
    expect(response.status).toBe(401);
    expect(dependencies.buildExport).not.toHaveBeenCalled();
  });

  it("returns 403 when no active workspace resolves", async () => {
    dependencies.workspaceId = undefined;
    const response = await GET();
    expect(response.status).toBe(403);
    expect(dependencies.buildExport).not.toHaveBeenCalled();
  });

  it.each(["member", "guest", "unknown-role"])(
    "returns 403 for a non-manager role (%s)",
    async (role) => {
      dependencies.membershipLimit.mockResolvedValue([{ role }]);
      const response = await GET();
      expect(response.status).toBe(403);
      expect(dependencies.buildExport).not.toHaveBeenCalled();
    },
  );

  it("returns 403 when the caller is not a member of the active workspace", async () => {
    dependencies.membershipLimit.mockResolvedValue([]);
    const response = await GET();
    expect(response.status).toBe(403);
    expect(dependencies.buildExport).not.toHaveBeenCalled();
  });

  it.each(["owner", "admin"])("exports for a manager role (%s)", async (role) => {
    dependencies.membershipLimit.mockResolvedValue([{ role }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(dependencies.buildExport).toHaveBeenCalledWith("ws_1", expect.any(Date));
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toMatch(
      /^attachment; filename="workspace-export-acme-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    const body = await response.json();
    expect(body.format).toBe("supastack.workspace-export");
  });

  it("records the workspace export audit event", async () => {
    await GET();
    expect(dependencies.audit).toHaveBeenCalledWith({
      action: "workspace.data_exported",
      actorUserId: "user_1",
      targetId: "ws_1",
      targetType: "workspace",
      workspaceId: "ws_1",
    });
  });

  it("short-circuits when the download limiter rejects", async () => {
    dependencies.limiter.mockResolvedValue(new Response("limited", { status: 429 }));
    const response = await GET();
    expect(response.status).toBe(429);
    expect(dependencies.buildExport).not.toHaveBeenCalled();
    expect(dependencies.audit).not.toHaveBeenCalled();
  });
});
