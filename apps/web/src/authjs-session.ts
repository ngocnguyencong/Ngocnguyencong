import { decode } from "next-auth/jwt";

import type { AuthSessionIdentity } from "./auth-session";

const AUTHJS_COOKIE_NAME = "authjs.session-token";
const AUTHJS_SECURE_COOKIE_NAME = "__Secure-authjs.session-token";
export const AUTHJS_IDENTITY_VERSION = "provider-account-v2";

/** Extracts the raw Auth.js session cookie value from a Cookie header. */
export function extractAuthJsSessionToken(cookieHeader: string | null): {
  cookieName: string;
  token: string;
} | null {
  if (cookieHeader === null) {
    return null;
  }
  for (const name of [AUTHJS_SECURE_COOKIE_NAME, AUTHJS_COOKIE_NAME]) {
    const prefix = `${name}=`;
    for (const part of cookieHeader.split(";")) {
      const trimmed = part.trim();
      if (trimmed.startsWith(prefix)) {
        const token = trimmed.slice(prefix.length);
        if (token !== "") {
          return { cookieName: name, token };
        }
      }
    }
  }
  return null;
}

/** Decodes a signed-in Auth.js JWT session from forwarded request headers. */
export async function getAuthJsSession(
  secret: string,
  headers: Headers,
): Promise<{ user: { id: string } } | null> {
  const cookie = extractAuthJsSessionToken(headers.get("cookie"));
  if (cookie === null) {
    return null;
  }

  try {
    const decoded = await decode({
      salt: cookie.cookieName,
      secret,
      token: cookie.token,
    });
    if (
      decoded === null ||
      decoded.identityVersion !== AUTHJS_IDENTITY_VERSION ||
      typeof decoded.userId !== "string" ||
      decoded.userId === ""
    ) {
      return null;
    }
    return { user: { id: decoded.userId } };
  } catch {
    return null;
  }
}

export function isActiveAuthJsIdentity<
  T extends Readonly<{ banned: boolean; emailVerified: boolean }>,
>(
  identity: T | null | undefined,
): identity is T & Readonly<{ banned: false; emailVerified: true }> {
  return identity !== null && identity !== undefined && identity.emailVerified && !identity.banned;
}

export async function resolveAuthJsSessionIdentity(
  session: Readonly<{ user: Readonly<{ id: string }> }> | null,
  findUser: (
    userId: string,
  ) => Promise<Readonly<{ banned: boolean; email: string; emailVerified: boolean }> | undefined>,
): Promise<AuthSessionIdentity | null> {
  if (session === null) return null;
  const record = await findUser(session.user.id);
  if (!isActiveAuthJsIdentity(record)) return null;
  return {
    user: {
      id: session.user.id,
    },
  };
}
