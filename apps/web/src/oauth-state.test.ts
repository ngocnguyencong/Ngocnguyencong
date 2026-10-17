import { describe, expect, it } from "vitest";

import {
  DEFAULT_OAUTH_RETURN_TO,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE_SECONDS,
  oauthStateCookieName,
  oauthStateCookieOptions,
  readCookieValue,
  sanitizeOAuthReturnTo,
  signOAuthState,
  verifyOAuthState,
} from "./oauth-state.js";

const SECRET = "test-secret-that-is-long-enough-32b";
const NOW = new Date("2026-09-24T12:00:00.000Z");

const payload = {
  actorUserId: "user_1",
  provider: "x",
  returnTo: "/settings/connections",
  state: "state-abc",
  verifier: "verifier-abc",
  workspaceId: "ws_1",
} as const;

const expected = {
  actorUserId: "user_1",
  provider: "x",
  workspaceId: "ws_1",
} as const;

function sign(overrides: Partial<typeof payload> = {}, now = NOW): string {
  return signOAuthState({ ...payload, ...overrides }, SECRET, now);
}

describe("signOAuthState / verifyOAuthState", () => {
  it("round-trips a signed payload", () => {
    const value = sign();
    expect(verifyOAuthState(value, SECRET, expected, NOW)).toEqual(payload);
  });

  it("rejects a tampered payload and a wrong secret", () => {
    const value = sign();
    const [body, sig] = value.split(".");
    const tamperedBody = `${body?.slice(0, -2)}${body?.endsWith("A") ? "B" : "A"}x`;
    expect(verifyOAuthState(`${tamperedBody}.${sig}`, SECRET, expected, NOW)).toBeNull();
    const tamperedSig = `${body}.${sig?.slice(0, -2)}${sig?.endsWith("A") ? "B" : "A"}x`;
    expect(verifyOAuthState(tamperedSig, SECRET, expected, NOW)).toBeNull();
    expect(verifyOAuthState(value, "other-secret", expected, NOW)).toBeNull();
  });

  it("rejects expired states and future-issued states", () => {
    const issuedLongAgo = sign(
      {},
      new Date(NOW.getTime() - (OAUTH_STATE_MAX_AGE_SECONDS + 1) * 1000),
    );
    expect(verifyOAuthState(issuedLongAgo, SECRET, expected, NOW)).toBeNull();

    const boundary = sign({}, new Date(NOW.getTime() - OAUTH_STATE_MAX_AGE_SECONDS * 1000));
    expect(verifyOAuthState(boundary, SECRET, expected, NOW)).toEqual(payload);

    const fromTheFuture = sign({}, new Date(NOW.getTime() + 61_000));
    expect(verifyOAuthState(fromTheFuture, SECRET, expected, NOW)).toBeNull();
  });

  it("rejects provider, workspace, and actor mismatches", () => {
    const value = sign();
    expect(verifyOAuthState(value, SECRET, { ...expected, provider: "google" }, NOW)).toBeNull();
    expect(
      verifyOAuthState(value, SECRET, { ...expected, workspaceId: "ws_other" }, NOW),
    ).toBeNull();
    // A state cookie signed for one user must not complete another's flow.
    expect(verifyOAuthState(value, SECRET, { ...expected, actorUserId: "user_2" }, NOW)).toBeNull();
  });

  it("rejects malformed values", () => {
    for (const bad of ["", "no-dot", "a.b.c", "!!!.sig", `${"e30"}.${"sig"}`]) {
      expect(verifyOAuthState(bad, SECRET, expected, NOW)).toBeNull();
    }
    // Valid signature over a payload missing required fields.
    const missingFields = signOAuthState({ provider: "x" } as never, SECRET, NOW);
    expect(verifyOAuthState(missingFields, SECRET, expected, NOW)).toBeNull();
  });
});

describe("sanitizeOAuthReturnTo", () => {
  it("keeps same-origin paths including query strings", () => {
    expect(sanitizeOAuthReturnTo("/settings/connections")).toBe("/settings/connections");
    expect(sanitizeOAuthReturnTo("/de/settings?tab=a#frag")).toBe("/de/settings?tab=a#frag");
    expect(sanitizeOAuthReturnTo(" /settings/members ")).toBe("/settings/members");
  });

  it("falls back for absolute, protocol-relative, or escaped URLs", () => {
    for (const bad of [
      "https://evil.example/steal",
      "//evil.example/path",
      "\\\\evil.example",
      "/\\evil",
      "javascript:alert(1)",
      "settings/connections",
      "",
      null,
      undefined,
    ]) {
      expect(sanitizeOAuthReturnTo(bad)).toBe(DEFAULT_OAUTH_RETURN_TO);
    }
  });
});

describe("readCookieValue", () => {
  it("reads a named cookie from a Cookie header", () => {
    const header = `a=1; ${OAUTH_STATE_COOKIE}=signed.value; b=2`;
    expect(readCookieValue(header, OAUTH_STATE_COOKIE)).toBe("signed.value");
  });

  it("returns null for missing cookie or header", () => {
    expect(readCookieValue(null, OAUTH_STATE_COOKIE)).toBeNull();
    expect(readCookieValue("a=1", OAUTH_STATE_COOKIE)).toBeNull();
  });
});

describe("oauthStateCookieOptions", () => {
  it("is httpOnly + lax + 10 minute, secure only in production", () => {
    expect(oauthStateCookieOptions(true)).toEqual({
      httpOnly: true,
      maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
    expect(oauthStateCookieOptions(false).secure).toBe(false);
  });
});

describe("oauthStateCookieName", () => {
  it("uses the __Host- prefix only when the cookie is Secure (production)", () => {
    expect(oauthStateCookieName(true)).toBe(`__Host-${OAUTH_STATE_COOKIE}`);
    expect(oauthStateCookieName(false)).toBe(OAUTH_STATE_COOKIE);
  });
});
