import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), find: vi.fn(), legacy: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./auth-runtime", () => ({
  getAuthSession: async () => ({ user: { id: "user_a" } }),
  database: {
    query: {
      workspaceMembership: { findMany: mocks.legacy },
      entitlement: { findMany: mocks.find },
    },
  },
}));
vi.mock("./mobile-workspace-context", () => ({ resolveMobileWorkspaceContext: mocks.resolve }));

import { GET } from "../app/api/mobile/entitlement/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.legacy.mockResolvedValue([{ workspaceId: "personal" }]);
  mocks.resolve.mockResolvedValue({ workspaceId: "organization", role: "owner", userId: "user_a" });
  mocks.find.mockResolvedValue([]);
});

it("reads the server-selected active workspace rather than the oldest membership", async () => {
  const response = await GET(new Request("https://app.test/api/mobile/entitlement"));
  expect((await response.json()).data.workspaceId).toBe("organization");
  expect(mocks.resolve).toHaveBeenCalledWith("user_a");
  expect(mocks.legacy).not.toHaveBeenCalled();
});

it("excludes expired grants before applying the latest-grant limit", async () => {
  await GET(new Request("https://app.test/api/mobile/entitlement"));
  const options = mocks.find.mock.calls[0]![0];
  const seen: unknown[][] = [];
  options.where(
    { workspaceId: "workspace", status: "status", expiresAt: "expiry" },
    {
      and: (...values: unknown[]) => values,
      or: (...values: unknown[]) => values,
      eq: (...values: unknown[]) => values,
      inArray: (...values: unknown[]) => values,
      isNull: (...values: unknown[]) => {
        seen.push(values);
        return values;
      },
      gt: (...values: unknown[]) => {
        seen.push(values);
        return values;
      },
    },
  );
  expect(seen).toContainEqual(["expiry"]);
  expect(seen.some((values) => values[0] === "expiry" && values[1] instanceof Date)).toBe(true);
});
