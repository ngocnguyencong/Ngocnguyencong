/**
 * Signed OAuth state cookie for the connected-account connect/callback flow.
 * The cookie carries everything the callback needs to finish the exchange —
 * the PKCE verifier, the CSRF `state` value, the workspace it belongs to, and
 * where to send the user afterwards — so the flow works without a server-side
 * session store. Integrity is HMAC-SHA256 over the JSON payload, keyed with
 * the auth secret; expiry is enforced inside the signature so a replayed or
 * maxAge-stripped cookie still fails closed.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const OAUTH_STATE_COOKIE = "supastack_oauth_state";
export const OAUTH_STATE_MAX_AGE_SECONDS = 600;
export const DEFAULT_OAUTH_RETURN_TO = "/settings/connections";

/** Small clock skew allowance so near-boundary states are not flaky. */
const FUTURE_SKEW_SECONDS = 60;

export interface OAuthStatePayload {
  readonly provider: string;
  readonly workspaceId: string;
  /**
   * The session user who started the connect flow — bound into the
   * signature so a cookie issued to one browser/session cannot complete a
   * callback under a different signed-in user.
   */
  readonly actorUserId: string;
  /** CSRF token mirrored as the provider `state` param. */
  readonly state: string;
  /** PKCE code verifier — secret until the callback. */
  readonly verifier: string;
  readonly returnTo: string;
}

interface SignedOAuthState extends OAuthStatePayload {
  /** Issued-at, unix seconds — the signature-enforced expiry anchor. */
  readonly iat: number;
}

export function signOAuthState(
  payload: OAuthStatePayload,
  secret: string,
  now: Date = new Date(),
): string {
  const body: SignedOAuthState = { ...payload, iat: Math.floor(now.getTime() / 1000) };
  const encoded = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyOAuthState(
  value: string,
  secret: string,
  expected: { actorUserId: string; provider: string; workspaceId: string },
  now: Date = new Date(),
): OAuthStatePayload | null {
  const dot = value.indexOf(".");
  if (dot <= 0 || dot === value.length - 1) {
    return null;
  }
  const encoded = value.slice(0, dot);
  const signature = value.slice(dot + 1);

  const expectedSignature = createHmac("sha256", secret).update(encoded).digest("base64url");
  if (!constantTimeEqual(signature, expectedSignature)) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  if (
    typeof record.provider !== "string" ||
    typeof record.workspaceId !== "string" ||
    typeof record.actorUserId !== "string" ||
    typeof record.state !== "string" ||
    typeof record.verifier !== "string" ||
    typeof record.returnTo !== "string" ||
    typeof record.iat !== "number" ||
    !Number.isFinite(record.iat)
  ) {
    return null;
  }

  const ageSeconds = Math.floor(now.getTime() / 1000) - record.iat;
  if (ageSeconds > OAUTH_STATE_MAX_AGE_SECONDS || ageSeconds < -FUTURE_SKEW_SECONDS) {
    return null;
  }
  if (
    record.provider !== expected.provider ||
    record.workspaceId !== expected.workspaceId ||
    record.actorUserId !== expected.actorUserId
  ) {
    return null;
  }

  return {
    actorUserId: record.actorUserId,
    provider: record.provider,
    returnTo: record.returnTo,
    state: record.state,
    verifier: record.verifier,
    workspaceId: record.workspaceId,
  };
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Only same-origin paths may be returned to — anything else collapses to the
 * connections settings page. `new URL` catches `//host` escapes and
 * credentials-in-URL tricks.
 */
export function sanitizeOAuthReturnTo(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return DEFAULT_OAUTH_RETURN_TO;
  }
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > 500 ||
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\")
  ) {
    return DEFAULT_OAUTH_RETURN_TO;
  }
  try {
    const base = "https://oauth-state.invalid";
    const url = new URL(trimmed, base);
    if (url.origin !== base) {
      return DEFAULT_OAUTH_RETURN_TO;
    }
    return url.pathname + url.search + url.hash;
  } catch {
    return DEFAULT_OAUTH_RETURN_TO;
  }
}

/**
 * The cookie name differs per environment: production sets the `__Host-`
 * prefixed name (Secure + Path=/ + no Domain are all satisfied), while the
 * plain name keeps working over http://localhost where `__Host-` cookies
 * would be rejected for lacking the Secure flag.
 */
export function oauthStateCookieName(secure: boolean): string {
  return secure ? `__Host-${OAUTH_STATE_COOKIE}` : OAUTH_STATE_COOKIE;
}

/** Minimal Cookie-header reader so route handlers stay framework-portable. */
export function readCookieValue(cookieHeader: string | null, name: string): string | null {
  if (cookieHeader === null) {
    return null;
  }
  const prefix = `${name}=`;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length);
    }
  }
  return null;
}

export function oauthStateCookieOptions(secure: boolean): {
  readonly httpOnly: true;
  readonly maxAge: number;
  readonly path: "/";
  readonly sameSite: "lax";
  readonly secure: boolean;
} {
  return {
    httpOnly: true,
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure,
  };
}
