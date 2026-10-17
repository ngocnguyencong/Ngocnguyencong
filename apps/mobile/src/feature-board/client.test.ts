import { describe, expect, test } from "vitest";

import { createMobileFeatureBoardActions } from "./client";

const boardPayload = {
  data: {
    canWrite: true,
    requests: [
      {
        createdAt: "2026-09-22T00:00:00.000Z",
        details: "Please",
        id: "fr_1",
        mine: false,
        status: "open",
        title: "Add CSV export",
        voteCount: 3,
      },
    ],
    votedRequestIds: ["fr_1"],
    workspaceId: "workspace-1",
  },
};

function makeActions(fetchImpl: (url: string, init: unknown) => Promise<unknown>) {
  return createMobileFeatureBoardActions(
    {
      apiUrl: "https://api.example.test",
      getCookie: async () => "better-auth.session_token=opaque-session",
    },
    fetchImpl as never,
  );
}

test("fetchBoard forwards the session cookie to the feature-requests endpoint", async () => {
  let request: { init: unknown; url: string } | undefined;
  const actions = makeActions(async (url, init) => {
    request = { init, url };
    return { json: async () => boardPayload, ok: true, status: 200 };
  });

  const board = await actions.fetchBoard();
  expect(board.requests).toHaveLength(1);
  expect(board.canWrite).toBe(true);
  expect(request).toEqual({
    init: {
      headers: { Accept: "application/json", Cookie: "better-auth.session_token=opaque-session" },
      method: "GET",
    },
    url: "https://api.example.test/api/mobile/feature-requests",
  });
});

test("createRequest posts the normalized payload", async () => {
  let request: { init: { body?: string }; url: string } | undefined;
  const actions = makeActions(async (url, init) => {
    request = { init: init as { body?: string }, url };
    return {
      json: async () => ({ data: { request: boardPayload.data.requests[0] } }),
      ok: true,
      status: 201,
    };
  });

  await actions.createRequest({ details: "d", title: "T" });
  expect(request?.url).toBe("https://api.example.test/api/mobile/feature-requests");
  expect(JSON.parse(request?.init.body ?? "{}")).toEqual({ details: "d", title: "T" });
});

test("toggleVote posts to the per-request vote endpoint", async () => {
  let request: { url: string } | undefined;
  const actions = makeActions(async (url) => {
    request = { url };
    return {
      json: async () => ({ data: { voteCount: 4, voted: true } }),
      ok: true,
      status: 200,
    };
  });

  const result = await actions.toggleVote("fr_1");
  expect(result).toEqual({ voteCount: 4, voted: true });
  expect(request?.url).toBe("https://api.example.test/api/mobile/feature-requests/fr_1/vote");
});

describe("error handling", () => {
  test("throws the server error message on failure", async () => {
    const actions = makeActions(async () => ({
      json: async () => ({ error: { code: "unauthorized", message: "Sign in required." } }),
      ok: false,
      status: 401,
    }));
    await expect(actions.fetchBoard()).rejects.toThrow("Sign in required.");
  });

  test("throws before any request when the session cookie is missing", async () => {
    let called = false;
    const actions = createMobileFeatureBoardActions(
      { apiUrl: "https://api.example.test", getCookie: async () => null },
      (async () => {
        called = true;
        return { json: async () => ({}), ok: true, status: 200 };
      }) as never,
    );
    await expect(actions.fetchBoard()).rejects.toThrow("session is unavailable");
    expect(called).toBe(false);
  });
});
