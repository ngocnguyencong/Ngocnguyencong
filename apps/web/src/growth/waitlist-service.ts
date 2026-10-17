import { randomUUID } from "node:crypto";

import { DEFAULT_LOCALE, getDictionary, isAppLocale } from "@supastack/i18n";

import type { GrowthStore } from "./early-access";
import { buildEarlyAccessUrl, isSelfReferral, normalizeWaitlistEmail } from "./waitlist";

/**
 * Waitlist join + admin invite orchestration against the `GrowthStore` seam.
 * Position is honest FIFO (count of entries created at-or-before the row) —
 * referral count influences admin invite ordering, not the displayed rank.
 */

export type WaitlistJoinResult =
  | { ok: true; outcome: "created"; position: number; referralCode: string }
  | { ok: true; outcome: "duplicate" };

export async function joinWaitlist(
  store: GrowthStore,
  input: {
    email: string;
    referral: string | null;
    now: Date;
    createId: () => string;
    referralCode: string;
  },
): Promise<WaitlistJoinResult> {
  const email = normalizeWaitlistEmail(input.email) ?? input.email;
  const referrer = input.referral
    ? await store.findWaitlistEntryByReferralCode(input.referral)
    : null;
  const referredBy = referrer && !isSelfReferral(referrer.email, email) ? referrer : null;

  const created = await store.createWaitlistEntry({
    id: input.createId(),
    email,
    status: "waiting",
    referralCode: input.referralCode,
    referralCount: 0,
    referredByEntryId: referredBy?.id ?? null,
    invitedAt: null,
    joinedAt: null,
    createdAt: input.now,
    updatedAt: input.now,
  });

  if (created === "duplicate") {
    return { ok: true, outcome: "duplicate" };
  }

  if (referredBy) {
    await store.recordReferral({
      id: `ref_${randomUUID()}`,
      code: input.referral!,
      kind: "waitlist",
      referrerEntryId: referredBy.id,
      referredEmail: email,
      referredUserId: null,
      createdAt: input.now,
    });
  }

  const position = await store.countWaitlistPosition(input.now);
  return { ok: true, outcome: "created", position, referralCode: input.referralCode };
}

/** Minimal sender seam — satisfied by the transactional EmailSender. */
export interface WaitlistMailer {
  send(message: {
    to: string;
    subject: string;
    text: string;
    footer: string;
    lang: string;
  }): Promise<unknown>;
}

export function buildEarlyAccessInviteEmail(input: {
  signupUrl: string;
  locale?: string | null | undefined;
}): { footer: string; lang: string; subject: string; text: string } {
  const locale = isAppLocale(input.locale) ? input.locale : DEFAULT_LOCALE;
  const copy = getDictionary(locale).mail;
  return {
    footer: copy.transactionalFooter,
    lang: locale,
    subject: copy.earlyAccessSubject,
    text: `${copy.earlyAccessBody(input.signupUrl)}\n\nIf you did not join the waitlist, ignore this email.`,
  };
}

export type InviteBatchResult = {
  invited: number;
  failed: string[];
  codes: Array<{ entryId: string; email: string; code: string }>;
};

/**
 * Single invite step shared by the batch loop and the per-entry admin action:
 * mint an email-bound code, flip the entry to `invited`, send the mail.
 * Returns "sent" or "failed" — the code/invited state stays either way.
 */
export async function issueEarlyAccessInvite(
  store: GrowthStore,
  entry: { id: string; email: string },
  input: {
    adminUserId: string;
    appUrl: string;
    locale: string;
    now: Date;
    send: WaitlistMailer["send"];
    createCode: () => string;
    createId: () => string;
    expiresAt?: Date | null | undefined;
  },
): Promise<{ outcome: "sent" | "failed"; code: string }> {
  const code = input.createCode();
  await store.createEarlyAccessCode({
    id: input.createId(),
    code,
    email: entry.email,
    waitlistEntryId: entry.id,
    createdByUserId: input.adminUserId,
    redeemedByUserId: null,
    redeemedAt: null,
    expiresAt: input.expiresAt ?? null,
  });
  await store.markWaitlistInvited({ id: entry.id, now: input.now });

  const mail = buildEarlyAccessInviteEmail({
    signupUrl: buildEarlyAccessUrl(input.appUrl, code),
    locale: input.locale,
  });
  try {
    await input.send({ to: entry.email, ...mail });
    return { outcome: "sent", code };
  } catch {
    return { outcome: "failed", code };
  }
}

/**
 * Invite the next `count` waiting entries — referral count desc, then oldest
 * first, so members who grew the list get access first. Mail failures are
 * reported per-address instead of aborting the batch.
 */
export async function inviteWaitlistEntries(
  store: GrowthStore,
  input: {
    count: number;
    adminUserId: string;
    appUrl: string;
    locale: string;
    now: Date;
    send: WaitlistMailer["send"];
    createCode: () => string;
    createId: () => string;
    expiresAt?: Date | null | undefined;
  },
): Promise<InviteBatchResult> {
  const candidates = await store.listWaitlistEntries({
    status: "waiting",
    limit: input.count,
    order: "referral",
  });
  const result: InviteBatchResult = { invited: 0, failed: [], codes: [] };

  for (const entry of candidates) {
    const { outcome, code } = await issueEarlyAccessInvite(store, entry, input);
    if (outcome === "sent") {
      result.invited += 1;
      result.codes.push({ entryId: entry.id, email: entry.email, code });
    } else {
      result.failed.push(entry.email);
    }
  }
  return result;
}
