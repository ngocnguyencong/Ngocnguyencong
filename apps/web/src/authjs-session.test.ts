import { encode } from "next-auth/jwt";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AUTHJS_IDENTITY_VERSION,
  extractAuthJsSessionToken,
  getAuthJsSession,
  isActiveAuthJsIdentity,
  resolveAuthJsSessionIdentity,
} from "./authjs-session";

const secret = "test-auth-secret-with-at-least-32-characters";

async function sessionCookie(
  userId: string,
  cookieName = "authjs.session-token",
  identityVersion?: string,
) {
  const token = await encode({
    salt: cookieName,
    secret,
    token: { userId, ...(identityVersion ? { identityVersion } : {}) },
  });
  return `${cookieName}=${token}`;
}

describe("extractAuthJsSessionToken", () => {
  it("finds the authjs session cookie among others", () => {
    expect(extractAuthJsSessionToken("a=1; authjs.session-token=tok123; b=2")).toEqual({
      cookieName: "authjs.session-token",
      token: "tok123",
    });
    expect(extractAuthJsSessionToken("__Secure-authjs.session-token=secure-tok")).toEqual({
      cookieName: "__Secure-authjs.session-token",
      token: "secure-tok",
    });
  });

  it("returns null when the cookie is missing or empty", () => {
    expect(extractAuthJsSessionToken(null)).toBeNull();
    expect(extractAuthJsSessionToken("a=1; b=2")).toBeNull();
    expect(extractAuthJsSessionToken("authjs.session-token=")).toBeNull();
  });
});

describe("getAuthJsSession", () => {
  it("decodes a valid JWT session into the shared identity shape", async () => {
    const headers = new Headers({
      cookie: await sessionCookie("usr_abc", undefined, AUTHJS_IDENTITY_VERSION),
    });
    await expect(getAuthJsSession(secret, headers)).resolves.toEqual({
      user: { id: "usr_abc" },
    });
  });

  it("rejects signed sessions minted before provider-account linking", async () => {
    await expect(
      getAuthJsSession(secret, new Headers({ cookie: await sessionCookie("usr_abc") })),
    ).resolves.toBeNull();
  });

  it("rejects credentials tokens minted before verified users became mandatory", async () => {
    await expect(
      getAuthJsSession(
        secret,
        new Headers({
          cookie: await sessionCookie("legacy-unverified", undefined, "provider-account-v1"),
        }),
      ),
    ).resolves.toBeNull();
  });

  it("rejects missing, malformed, or wrongly-signed sessions", async () => {
    await expect(getAuthJsSession(secret, new Headers())).resolves.toBeNull();
    await expect(
      getAuthJsSession(secret, new Headers({ cookie: "authjs.session-token=not-a-jwt" })),
    ).resolves.toBeNull();
    await expect(
      getAuthJsSession(
        "different-secret-with-at-least-32-characters",
        new Headers({ cookie: await sessionCookie("usr_abc") }),
      ),
    ).resolves.toBeNull();
  });
});

describe("resolveAuthJsSessionIdentity", () => {
  it("rechecks current verification and ban state for each decoded token", async () => {
    const findUser = vi.fn(async (userId: string) =>
      userId === "usr_active"
        ? { banned: false, email: "a@b.test", emailVerified: true }
        : userId === "usr_banned"
          ? { banned: true, email: "b@b.test", emailVerified: true }
          : { banned: false, email: "c@b.test", emailVerified: false },
    );
    await expect(
      resolveAuthJsSessionIdentity({ user: { id: "usr_active" } }, findUser),
    ).resolves.toEqual({
      user: { id: "usr_active" },
    });
    await expect(
      resolveAuthJsSessionIdentity({ user: { id: "usr_banned" } }, findUser),
    ).resolves.toBeNull();
    await expect(
      resolveAuthJsSessionIdentity({ user: { id: "usr_unverified" } }, findUser),
    ).resolves.toBeNull();
    await expect(resolveAuthJsSessionIdentity(null, findUser)).resolves.toBeNull();
    expect(findUser).toHaveBeenCalledTimes(3);
  });

  it("requires a verified, unbanned identity", () => {
    expect(isActiveAuthJsIdentity({ banned: false, emailVerified: true })).toBe(true);
    expect(isActiveAuthJsIdentity({ banned: true, emailVerified: true })).toBe(false);
    expect(isActiveAuthJsIdentity({ banned: false, emailVerified: false })).toBe(false);
    expect(isActiveAuthJsIdentity(null)).toBe(false);
  });
});
