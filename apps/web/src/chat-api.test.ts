import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  memberships: [] as { role: string; workspaceId: string; workspaceType: string }[],
  activeWorkspaceId: "ws_org" as string | null,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (state.activeWorkspaceId ? { value: state.activeWorkspaceId } : undefined),
  }),
}));
vi.mock("./auth-runtime", () => ({
  database: {
    query: { userWorkspacePreference: { findFirst: async () => undefined } },
    select: () => ({
      from: () => ({ innerJoin: () => ({ where: async () => state.memberships }) }),
    }),
  },
}));

import { resolveChatScope } from "./chat-api";

afterEach(() => {
  state.memberships = [];
  state.activeWorkspaceId = "ws_org";
});

describe("resolveChatScope", () => {
  it("keeps guest reads but denies guest writes in the selected workspace", async () => {
    state.memberships = [
      { role: "owner", workspaceId: "ws_personal", workspaceType: "personal" },
      { role: "guest", workspaceId: "ws_org", workspaceType: "organization" },
    ];
    await expect(resolveChatScope("user-a")).resolves.toEqual({
      userId: "user-a",
      workspaceId: "ws_org",
    });
    await expect(resolveChatScope("user-a", "write")).resolves.toBeNull();
  });

  it("allows members to write in their selected workspace", async () => {
    state.memberships = [{ role: "member", workspaceId: "ws_org", workspaceType: "organization" }];
    await expect(resolveChatScope("user-a", "write")).resolves.toEqual({
      userId: "user-a",
      workspaceId: "ws_org",
    });
  });
});
