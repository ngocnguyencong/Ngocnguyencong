import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authEngine: "better-auth" as "better-auth" | "authjs",
  getSession: vi.fn(async (input: unknown) => {
    void input;
    return null as unknown;
  }),
  headers: {} as Headers,
  setPassword: vi.fn(async (input: unknown) => {
    void input;
  }),
}));

vi.mock("next/headers", () => ({ headers: async () => state.headers }));
vi.mock("./auth-runtime", () => ({
  get authEngine() {
    return state.authEngine;
  },
  auth: {
    api: {
      getSession: (input: unknown) => state.getSession(input),
      setPassword: (input: unknown) => state.setPassword(input),
    },
  },
}));

import { createSignupPassword } from "./verified-signup-actions";

describe("createSignupPassword server action", () => {
  beforeEach(() => {
    state.authEngine = "better-auth";
    state.getSession.mockReset().mockResolvedValue(null);
    state.setPassword.mockReset().mockResolvedValue(undefined);
  });

  it("does not call Better Auth without a verified, non-banned session", async () => {
    await expect(createSignupPassword("StrongEnough123")).resolves.toBe(false);
    expect(state.setPassword).not.toHaveBeenCalled();

    state.getSession.mockResolvedValue({ user: { emailVerified: false, banned: false } });
    await expect(createSignupPassword("StrongEnough123")).resolves.toBe(false);
    expect(state.setPassword).not.toHaveBeenCalled();

    state.getSession.mockResolvedValue({ user: { emailVerified: true, banned: true } });
    await expect(createSignupPassword("StrongEnough123")).resolves.toBe(false);
    expect(state.setPassword).not.toHaveBeenCalled();
  });

  it("binds the write to the current Better Auth session headers", async () => {
    state.getSession.mockResolvedValue({ user: { emailVerified: true, banned: false } });

    await expect(createSignupPassword("StrongEnough123")).resolves.toBe(true);
    expect(state.getSession).toHaveBeenCalledWith({ headers: state.headers });
    expect(state.setPassword).toHaveBeenCalledWith({
      body: { newPassword: "StrongEnough123" },
      headers: state.headers,
    });
  });

  it("refuses the Better Auth password action when Auth.js is selected", async () => {
    state.authEngine = "authjs";

    await expect(createSignupPassword("StrongEnough123")).resolves.toBe(false);
    expect(state.getSession).not.toHaveBeenCalled();
    expect(state.setPassword).not.toHaveBeenCalled();
  });

  it("does not return internal Better Auth errors", async () => {
    state.getSession.mockResolvedValue({ user: { emailVerified: true, banned: false } });
    state.setPassword.mockRejectedValue(new Error("private failure detail"));

    await expect(createSignupPassword("StrongEnough123")).resolves.toBe(false);
  });
});
