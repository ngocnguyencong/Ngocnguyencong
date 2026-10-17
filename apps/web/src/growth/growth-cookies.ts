import { sanitizeGrowthParam } from "./waitlist";

/**
 * `?ref=` / `?invite=` first-touch capture. proxy.ts writes these httpOnly
 * cookies so the codes survive navigation until the waitlist join action or
 * the auth hook reads them. Values are sanitized on write AND on read — a
 * tampered cookie degrades to "no code", never to a query parameter.
 */

export const REFERRAL_COOKIE = "supastack_ref";
export const INVITE_COOKIE = "supastack_invite";

/** Referral attribution lasts 30 days; invite codes follow their row expiry. */
const REFERRAL_MAX_AGE = 60 * 60 * 24 * 30;
const INVITE_MAX_AGE = 60 * 60 * 24 * 14;

export type CookieSpec = {
  name: string;
  value: string;
  options: {
    path: string;
    httpOnly: boolean;
    sameSite: "lax";
    maxAge: number;
  };
};

/** Cookies to set for the current request's query params (empty when none). */
export function growthCookiesToSet(searchParams: URLSearchParams): CookieSpec[] {
  const specs: CookieSpec[] = [];
  const ref = sanitizeGrowthParam(searchParams.get("ref"));
  const invite = sanitizeGrowthParam(searchParams.get("invite"));
  if (ref) {
    specs.push({
      name: REFERRAL_COOKIE,
      value: ref,
      options: { path: "/", httpOnly: true, sameSite: "lax", maxAge: REFERRAL_MAX_AGE },
    });
  }
  if (invite) {
    specs.push({
      name: INVITE_COOKIE,
      value: invite,
      options: { path: "/", httpOnly: true, sameSite: "lax", maxAge: INVITE_MAX_AGE },
    });
  }
  return specs;
}

export type CookieReader = {
  get(name: string): { name: string; value: string } | undefined;
};

/** Read sanitized growth codes from any cookie jar (request or server store). */
export function readGrowthCookies(cookies: CookieReader): {
  ref: string | null;
  invite: string | null;
} {
  return {
    ref: sanitizeGrowthParam(cookies.get(REFERRAL_COOKIE)?.value),
    invite: sanitizeGrowthParam(cookies.get(INVITE_COOKIE)?.value),
  };
}
