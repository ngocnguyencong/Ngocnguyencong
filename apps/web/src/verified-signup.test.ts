import { describe, expect, it, vi } from "vitest";

import { createVerifiedSignupPasswordHandler } from "./verified-signup.js";

describe("verified signup password gate", () => {
  it("rejects malformed and out-of-range passwords before reading a session", async () => {
    const getSession = vi.fn(async () => ({ emailVerified: true, banned: false }));
    const setPassword = vi.fn(async () => undefined);
    const createPassword = createVerifiedSignupPasswordHandler({ getSession, setPassword });

    await expect(createPassword("short")).resolves.toBe(false);
    await expect(createPassword("x".repeat(129))).resolves.toBe(false);
    await expect(createPassword(null)).resolves.toBe(false);
    expect(getSession).not.toHaveBeenCalled();
    expect(setPassword).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", null],
    ["unverified", { emailVerified: false, banned: false }],
    ["banned", { emailVerified: true, banned: true }],
  ] as const)("does not set a password for a %s session", async (_name, session) => {
    const setPassword = vi.fn(async () => undefined);
    const createPassword = createVerifiedSignupPasswordHandler({
      getSession: async () => session,
      setPassword,
    });

    await expect(createPassword("StrongEnough123")).resolves.toBe(false);
    expect(setPassword).not.toHaveBeenCalled();
  });

  it("sets the password only for a verified, non-banned session", async () => {
    const setPassword = vi.fn(async (password: string) => {
      void password;
    });
    const createPassword = createVerifiedSignupPasswordHandler({
      getSession: async () => ({ emailVerified: true, banned: false }),
      setPassword,
    });

    await expect(createPassword("StrongEnough123")).resolves.toBe(true);
    expect(setPassword).toHaveBeenCalledWith("StrongEnough123");
  });

  it("fails closed if session lookup or Better Auth password creation fails", async () => {
    const noSession = createVerifiedSignupPasswordHandler({
      getSession: async () => {
        throw new Error("private session detail");
      },
      setPassword: vi.fn(async () => undefined),
    });
    const failedWrite = createVerifiedSignupPasswordHandler({
      getSession: async () => ({ emailVerified: true, banned: false }),
      setPassword: async () => {
        throw new Error("private password detail");
      },
    });

    await expect(noSession("StrongEnough123")).resolves.toBe(false);
    await expect(failedWrite("StrongEnough123")).resolves.toBe(false);
  });
});
