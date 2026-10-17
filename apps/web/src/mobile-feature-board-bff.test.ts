import { describe, expect, it } from "vitest";

import {
  createMobileFeatureBoardBff,
  type MobileFeatureBoardDependencies,
} from "./mobile-feature-board-bff";

const request = {
  createdAt: "2026-09-22T00:00:00.000Z",
  details: "Please",
  id: "fr_1",
  mine: false,
  status: "open" as const,
  title: "Add CSV export",
  voteCount: 3,
};

function makeBff(overrides: Partial<MobileFeatureBoardDependencies> = {}) {
  const deps: MobileFeatureBoardDependencies = {
    createRequest: async () => ({ request }),
    getSession: async () => ({ user: { id: "user-1" } }),
    listRequests: async () => ({ requests: [request], votedRequestIds: ["fr_1"] }),
    resolveWorkspace: async () => ({ role: "member", workspaceId: "ws-1" }),
    toggleVote: async () => ({ voteCount: 4, voted: true }),
    ...overrides,
  };
  return { bff: createMobileFeatureBoardBff(deps), deps };
}

describe("mobile feature board BFF list", () => {
  it("returns 401 without a session", async () => {
    const { bff } = makeBff({ getSession: async () => null });
    const response = await bff.list(new Headers());
    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: { code: "unauthorized", message: expect.any(String) },
    });
  });

  it("returns 404 when the user has no workspace", async () => {
    const { bff } = makeBff({ resolveWorkspace: async () => null });
    const response = await bff.list(new Headers());
    expect(response.status).toBe(404);
  });

  it("returns requests with the viewer's votes and write capability", async () => {
    const { bff } = makeBff();
    const response = await bff.list(new Headers());
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        canWrite: true,
        requests: [request],
        votedRequestIds: ["fr_1"],
        workspaceId: "ws-1",
      },
    });
  });

  it("reports guests as read-only", async () => {
    const { bff } = makeBff({
      resolveWorkspace: async () => ({ role: "guest", workspaceId: "ws-1" }),
    });
    const response = await bff.list(new Headers());
    expect(response.status).toBe(200);
    if (response.status === 200) {
      expect(response.body.data.canWrite).toBe(false);
    }
  });
});

describe("mobile feature board BFF create", () => {
  it("rejects guests with 403", async () => {
    const { bff } = makeBff({
      resolveWorkspace: async () => ({ role: "guest", workspaceId: "ws-1" }),
    });
    const response = await bff.create(new Headers(), { title: "x" });
    expect(response.status).toBe(403);
  });

  it("rejects invalid input with 422", async () => {
    const { bff } = makeBff();
    const response = await bff.create(new Headers(), { title: "" });
    expect(response.status).toBe(422);
  });

  it("creates a request scoped to the resolved workspace", async () => {
    let seen: { workspaceId?: string; userId?: string } = {};
    const { bff } = makeBff({
      createRequest: async (input) => {
        seen = input;
        return { request };
      },
    });
    const response = await bff.create(new Headers(), { details: "d", title: "T" });
    expect(response.status).toBe(201);
    expect(seen).toEqual({
      details: "d",
      title: "T",
      userId: "user-1",
      workspaceId: "ws-1",
    });
  });
});

describe("mobile feature board BFF vote", () => {
  it("rejects guests with 403", async () => {
    const { bff } = makeBff({
      resolveWorkspace: async () => ({ role: "guest", workspaceId: "ws-1" }),
    });
    const response = await bff.vote(new Headers(), "fr_1");
    expect(response.status).toBe(403);
  });

  it("returns 404 when the request is outside the workspace", async () => {
    const { bff } = makeBff({ toggleVote: async () => null });
    const response = await bff.vote(new Headers(), "fr_elsewhere");
    expect(response.status).toBe(404);
  });

  it("returns the toggled vote state", async () => {
    const { bff } = makeBff();
    const response = await bff.vote(new Headers(), "fr_1");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { voteCount: 4, voted: true } });
  });
});
