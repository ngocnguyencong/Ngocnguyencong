import { randomBytes } from "node:crypto";

import { parseEmail } from "../marketing/marketing-leads";

/**
 * Pure logic for the platform-level growth surface: the product's own
 * waitlist, early-access invite codes, and `?ref=` referral attribution.
 * Records live in `waitlist_entry` / `early_access_code` / `referral` and are
 * deliberately NOT workspace-scoped — they are pre-auth marketing assets owned
 * by the deployment, like `announcement`/`feature_flag`.
 */

export const WAITLIST_STATUSES = ["waiting", "invited", "joined"] as const;
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];

export type EarlyAccessCodeLike = {
  code: string;
  email: string | null;
  redeemedAt: Date | null;
  expiresAt: Date | null;
};

export type EarlyAccessStatus = "valid" | "unknown" | "expired" | "redeemed" | "email-mismatch";

export type WaitlistJoinParse = { ok: true; email: string } | { ok: false; error: "invalid-email" };

/** Waitlist signups reuse the marketing email rule: trim, lowercase, validate. */
export function normalizeWaitlistEmail(value: string): string | null {
  return parseEmail(value);
}

export function parseWaitlistJoin(input: { email: string }): WaitlistJoinParse {
  const email = normalizeWaitlistEmail(input.email);
  return email ? { ok: true, email } : { ok: false, error: "invalid-email" };
}

const CODE_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomCode(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return out;
}

/** Shareable `?ref=` code minted per waitlist entry. */
export function generateReferralCode(): string {
  return randomCode(10);
}

/** Early-access invite code issued by an admin (`?invite=`). */
export function generateInviteCode(): string {
  return randomCode(12);
}

const GROWTH_PARAM = /^[a-z0-9\-_]{1,64}$/i;

/**
 * Sanitize a `?ref=`/`?invite=` value before it ever touches a cookie or a
 * query. Returns the lowercased code or null when it cannot be a code.
 */
export function sanitizeGrowthParam(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!GROWTH_PARAM.test(trimmed)) {
    return null;
  }
  return trimmed.toLowerCase();
}

/**
 * Evaluate an early-access code row for a signup attempt. Email-bound codes
 * only work for that address; unredeemed codes with no expiry are always ok.
 */
export function earlyAccessCodeStatus(
  code: EarlyAccessCodeLike | null | undefined,
  context: { email: string; now: Date },
): EarlyAccessStatus {
  if (!code) {
    return "unknown";
  }
  if (code.redeemedAt) {
    return "redeemed";
  }
  if (code.expiresAt && code.expiresAt.getTime() <= context.now.getTime()) {
    return "expired";
  }
  if (code.email && code.email !== context.email.trim().toLowerCase()) {
    return "email-mismatch";
  }
  return "valid";
}

/** Invite email/signup link — proxy.ts turns `?invite=` into an httpOnly cookie. */
export function buildEarlyAccessUrl(appUrl: string, code: string): string {
  const base = appUrl.replace(/\/+$/, "");
  return `${base}/auth?invite=${encodeURIComponent(code)}`;
}

/** Share link a waitlist member posts to climb the list via `?ref=`. */
export function buildWaitlistShareUrl(appUrl: string, referralCode: string): string {
  const base = appUrl.replace(/\/+$/, "");
  return `${base}/?ref=${encodeURIComponent(referralCode)}`;
}

/**
 * A waitlist entry must not collect referral credit for referring its own
 * email (self-join under a second alias is still allowed — it just earns no
 * referral row).
 */
export function isSelfReferral(
  referrerEmail: string | null | undefined,
  refereeEmail: string,
): boolean {
  if (!referrerEmail) {
    return false;
  }
  return referrerEmail.toLowerCase() === refereeEmail.toLowerCase();
}

export type WaitlistStatusContext = {
  position?: number | undefined;
  referralCode?: string | undefined;
};

/** Copy for the waitlist band's redirect-back status banner. */
export function waitlistStatusMessage(
  status: string | undefined,
  context: WaitlistStatusContext,
): string | null {
  if (!status) {
    return null;
  }
  if (status === "joined") {
    const parts: string[] = [];
    if (context.position) {
      parts.push(`You are #${context.position} on the waitlist.`);
    } else {
      parts.push("You are on the waitlist.");
    }
    if (context.referralCode) {
      parts.push(`Share your link to move up: code ${context.referralCode}.`);
    }
    return parts.join(" ");
  }
  if (status === "duplicate") {
    return "That email is already on the waitlist.";
  }
  if (status === "invalid-email") {
    return "Enter a valid email address.";
  }
  if (status === "captcha") {
    return "Complete the human check and try again.";
  }
  if (status === "unavailable") {
    return "The waitlist is not connected yet.";
  }
  return null;
}
