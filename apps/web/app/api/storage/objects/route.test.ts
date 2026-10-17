import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

const dependencies = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  membershipLimit: vi.fn(),
  storage: { getObject: vi.fn() },
}));
vi.mock("../../../../src/auth-runtime", () => ({
  database: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: dependencies.membershipLimit }),
      }),
    }),
  },
  getAuthSession: dependencies.getAuthSession,
}));
vi.mock("../../../../src/storage-runtime", () => ({
  createServerObjectStorage: () => dependencies.storage,
}));

import { GET } from "./route";

const session = { user: { id: "user_1" } };
const request = (query: string) =>
  new Request(`https://app.example.test/api/storage/objects?${query}`);
const memberRequest = request("workspaceId=ws_1&key=ws_1%2Favatar%2Fa.png");

beforeEach(() => {
  dependencies.getAuthSession.mockReset().mockResolvedValue(session);
  dependencies.membershipLimit.mockReset().mockResolvedValue([{ role: "viewer" }]);
  dependencies.storage.getObject.mockReset().mockResolvedValue(undefined);
});

describe("GET /api/storage/objects", () => {
  it("returns 401 when unauthenticated", async () => {
    dependencies.getAuthSession.mockResolvedValue(null);
    const response = await GET(memberRequest);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it.each(["", "workspaceId=ws_1", "key=ws_1%2Favatar%2Fa.png"])(
    "returns 400 when required params are missing (%s)",
    async (query) => {
      const response = await GET(request(query));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "workspaceId and key are required",
      });
    },
  );

  it.each(["other%2Favatar.png", "ws_1%2F..%2Fsecret"])(
    "returns 400 for a key outside the workspace prefix (%s)",
    async (key) => {
      const response = await GET(request(`workspaceId=ws_1&key=${key}`));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Invalid object key" });
    },
  );

  it("returns 400 for an invalid key even when the caller is not a member", async () => {
    dependencies.membershipLimit.mockResolvedValue([]);
    const response = await GET(request("workspaceId=ws_1&key=other%2Favatar.png"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid object key" });
    expect(dependencies.membershipLimit).not.toHaveBeenCalled();
  });

  it("scopes membership lookup to (workspaceId, session.user.id)", () => {
    const source = readFileSync(join(here, "route.ts"), "utf8");
    expect(source).toContain("eq(workspaceMembership.workspaceId, workspaceId)");
    expect(source).toContain("eq(workspaceMembership.userId, session.user.id)");
  });

  it("returns 403 when the signed-in user is not a workspace member", async () => {
    dependencies.membershipLimit.mockResolvedValue([]);
    const response = await GET(memberRequest);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
    expect(dependencies.membershipLimit).toHaveBeenCalledWith(1);
    expect(dependencies.storage.getObject).not.toHaveBeenCalled();
  });

  it("returns 404 when the object does not exist", async () => {
    const response = await GET(memberRequest);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
    expect(dependencies.membershipLimit).toHaveBeenCalledWith(1);
    expect(dependencies.storage.getObject).toHaveBeenCalledWith({
      key: "ws_1/avatar/a.png",
      workspaceId: "ws_1",
    });
  });

  it("returns the object body and content type for members", async () => {
    dependencies.storage.getObject.mockResolvedValue({
      body: Uint8Array.from([1, 2, 3]),
      contentType: "image/png",
      key: "ws_1/avatar/a.png",
      workspaceId: "ws_1",
    });
    const response = await GET(memberRequest);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, max-age=60");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(dependencies.membershipLimit).toHaveBeenCalledWith(1);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(Uint8Array.from([1, 2, 3]));
  });
});
