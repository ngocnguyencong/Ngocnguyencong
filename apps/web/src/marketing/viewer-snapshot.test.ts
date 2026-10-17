import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  session: null as { user: { id: string } } | null,
  sessionError: null as Error | null,
}));

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

vi.mock("../auth-runtime", () => ({
  getAuthSession: async () => {
    if (state.sessionError !== null) {
      throw state.sessionError;
    }
    return state.session;
  },
}));

import { getViewerSnapshot } from "./viewer-snapshot";

beforeEach(() => {
  state.session = null;
  state.sessionError = null;
});

describe("getViewerSnapshot", () => {
  it("reports a confirmed guest", async () => {
    await expect(getViewerSnapshot()).resolves.toEqual({ signedIn: false });
  });

  it("reports a signed-in viewer", async () => {
    state.session = { user: { id: "u_member" } };
    await expect(getViewerSnapshot()).resolves.toEqual({ signedIn: true });
  });

  it("returns undefined when the session probe fails", async () => {
    state.sessionError = new Error("auth backend down");
    await expect(getViewerSnapshot()).resolves.toBeUndefined();
  });
});
