import { randomUUID } from "node:crypto";

import type { EarlyAccessStatus } from "./waitlist";
import { earlyAccessCodeStatus, isSelfReferral, normalizeWaitlistEmail } from "./waitlist";

/**
 * Orchestration for the early-access lifecycle, written against a narrow
 * store seam so the decision flow is unit-testable without Postgres. The
 * drizzle implementation lives in `growth-store.ts`; atomicity rules
 * (conditional redeem, idempotent referral insert + counter bump) are owned
 * by the store implementation.
 */

export type EarlyAccessCodeRow = {
  id: string;
  code: string;
  email: string | null;
  waitlistEntryId: string | null;
  createdByUserId: string | null;
  redeemedByUserId: string | null;
  redeemedAt: Date | null;
  expiresAt: Date | null;
};

export type WaitlistEntryRow = {
  id: string;
  email: string;
  status: string;
  referralCode: string;
  referralCount: number;
  referredByEntryId: string | null;
  invitedAt: Date | null;
  joinedAt: Date | null;
  createdAt: Date;
};

export type ReferralInsert = {
  id: string;
  code: string;
  kind: "waitlist" | "signup";
  referrerEntryId: string | null;
  referredEmail: string | null;
  referredUserId: string | null;
  createdAt: Date;
};

export interface GrowthStore {
  findEarlyAccessCode(code: string): Promise<EarlyAccessCodeRow | null>;
  /**
   * Atomically reserve an unbound, unredeemed code for its first verified
   * mailbox. The same normalized mailbox may retry if user creation fails.
   */
  bindEarlyAccessCodeEmail(input: { id: string; email: string; now: Date }): Promise<boolean>;
  findWaitlistEntryByEmail(email: string): Promise<WaitlistEntryRow | null>;
  findWaitlistEntryById(id: string): Promise<WaitlistEntryRow | null>;
  findWaitlistEntryByReferralCode(code: string): Promise<WaitlistEntryRow | null>;
  /** Unique-email insert — returns "duplicate" instead of throwing. */
  createWaitlistEntry(
    row: WaitlistEntryRow & { updatedAt: Date },
  ): Promise<"created" | "duplicate">;
  /** 1-based queue position: entries created at or before `createdAt`. */
  countWaitlistPosition(createdAt: Date): Promise<number>;
  listWaitlistEntries(input: {
    status?: string | undefined;
    limit: number;
    /** "fifo" = oldest first; "referral" = referralCount desc then oldest. */
    order: "fifo" | "referral";
  }): Promise<WaitlistEntryRow[]>;
  createEarlyAccessCode(row: EarlyAccessCodeRow): Promise<void>;
  /** Conditional update — returns false when the code was already redeemed. */
  redeemEarlyAccessCode(input: { id: string; userId: string; now: Date }): Promise<boolean>;
  /** Idempotent — returns false when the entry was already joined/missing. */
  markWaitlistJoined(input: { id: string; now: Date }): Promise<boolean>;
  /** Only flips waiting → invited so re-invites do not regress joined rows. */
  markWaitlistInvited(input: { id: string; now: Date }): Promise<boolean>;
  deleteWaitlistEntry(id: string): Promise<boolean>;
  /**
   * Insert a referral row and, when the insert wins, bump the referrer's
   * denormalized `referralCount` in the same transaction. Unique indexes on
   * (kind, referredUserId)/(kind, referredEmail) make this idempotent.
   */
  recordReferral(row: ReferralInsert): Promise<"created" | "duplicate">;
}

/** DB-backed invite-code check for the auth `validateUserInfo` gate. */
export async function validateEarlyAccessCode(
  store: GrowthStore,
  input: { code: string; email: string; now: Date },
): Promise<EarlyAccessStatus> {
  const email = normalizeWaitlistEmail(input.email);
  if (!email) return "unknown";
  const row = await store.findEarlyAccessCode(input.code);
  const status = earlyAccessCodeStatus(row, { email, now: input.now });
  if (status !== "valid" || !row) return status;

  if (await store.bindEarlyAccessCodeEmail({ id: row.id, email, now: input.now })) {
    return "valid";
  }

  // A concurrent request may have claimed the unbound row for another
  // mailbox, redeemed it, or let it expire after our initial read. Re-read
  // the committed row and fail closed if the store cannot explain the loss.
  const current = await store.findEarlyAccessCode(input.code);
  const currentStatus = earlyAccessCodeStatus(current, { email, now: input.now });
  return currentStatus === "valid" ? "unknown" : currentStatus;
}

/**
 * Post-user-creation side effects, called from the better-auth `after` hook:
 *
 * 1. Redeem the invite cookie's code when it is still valid for this email —
 *    invite-only mode already gated, but in open mode this is the redemption.
 * 2. Mark the matching waitlist entry `joined` (code-bound entry wins, then
 *    the entry whose email matches the new account).
 * 3. Record a `signup` referral row crediting the `?ref=` code owner, unless
 *    the code belongs to the new user themselves.
 *
 * Everything degrades to a no-op for missing/invalid/stale data — a webhook or
 * double delivery must never break account creation.
 */
export type EarlyAccessCreateOutcome = {
  redeemedCode: string | null;
  joinedWaitlistEntryId: string | null;
  referralRecorded: boolean;
};

export async function handleEarlyAccessUserCreated(
  store: GrowthStore,
  input: {
    user: { id: string; email: string };
    invite: string | null;
    referral: string | null;
    now: Date;
  },
): Promise<EarlyAccessCreateOutcome> {
  const email = normalizeWaitlistEmail(input.user.email) ?? input.user.email.toLowerCase();
  const outcome: EarlyAccessCreateOutcome = {
    redeemedCode: null,
    joinedWaitlistEntryId: null,
    referralRecorded: false,
  };

  if (input.invite) {
    const code = await store.findEarlyAccessCode(input.invite);
    const status = earlyAccessCodeStatus(code, { email, now: input.now });
    if (code && status === "valid") {
      const redeemed = await store.redeemEarlyAccessCode({
        id: code.id,
        userId: input.user.id,
        now: input.now,
      });
      if (redeemed) {
        outcome.redeemedCode = code.code;
        outcome.joinedWaitlistEntryId = code.waitlistEntryId;
      }
    }
  }

  const entryByEmail = await store.findWaitlistEntryByEmail(email);
  const entryToJoin = outcome.joinedWaitlistEntryId ?? entryByEmail?.id ?? null;
  if (entryToJoin) {
    const joined = await store.markWaitlistJoined({ id: entryToJoin, now: input.now });
    outcome.joinedWaitlistEntryId = joined ? entryToJoin : null;
  }

  if (input.referral) {
    const referrer = await store.findWaitlistEntryByReferralCode(input.referral);
    if (referrer && !isSelfReferral(referrer.email, email)) {
      const recorded = await store.recordReferral({
        id: `ref_${randomUUID()}`,
        code: input.referral,
        kind: "signup",
        referrerEntryId: referrer.id,
        referredEmail: email,
        referredUserId: input.user.id,
        createdAt: input.now,
      });
      outcome.referralRecorded = recorded === "created";
    }
  }

  return outcome;
}
