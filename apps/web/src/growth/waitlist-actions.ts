"use server";

import { randomUUID } from "node:crypto";

import { AUDIT_ACTIONS } from "@supastack/db";
import { parseServerConfig } from "@supastack/config";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { requireAdminSession } from "../admin-actions";
import { recordAuditEvent } from "../audit-runtime";
import { database } from "../auth-runtime";
import { getCaptchaVerifier } from "../captcha";
import { marketingPublicWriteAllowed } from "../public-write-admission-runtime";
import { createServerTransactionalEmailSender } from "../server-provider-composition";
import { createGrowthStore } from "./growth-store";
import { readGrowthCookies } from "./growth-cookies";
import {
  generateInviteCode,
  generateReferralCode,
  normalizeWaitlistEmail,
  parseWaitlistJoin,
} from "./waitlist";
import { inviteWaitlistEntries, issueEarlyAccessInvite, joinWaitlist } from "./waitlist-service";

const serverConfig = parseServerConfig();
const growthStore = createGrowthStore(database);
const transactionalMail = createServerTransactionalEmailSender(serverConfig.providers.email);

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function captchaOk(formData: FormData, headerList: Headers): Promise<boolean> {
  const remoteIp = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  return getCaptchaVerifier().verify(formString(formData, "cf-turnstile-response"), remoteIp);
}

/** Public landings live at `/` plus `/de` `/es` `/fr` — anything else falls back to root. */
function landingPath(locale: string): string {
  return ["de", "es", "fr"].includes(locale) ? `/${locale}` : "/";
}

function waitlistDestination(
  status: string,
  locale: string,
  extra?: Record<string, string>,
): string {
  const params = new URLSearchParams({ waitlist: status, ...extra });
  return `${landingPath(locale)}?${params.toString()}#waitlist`;
}

/**
 * Public waitlist signup. Captcha-gated like the contact/newsletter forms,
 * dedupes by email, attributes `?ref=` (httpOnly cookie written by proxy.ts),
 * and redirects back to the landing page's #waitlist anchor with the result.
 */
export async function joinWaitlistAction(formData: FormData): Promise<void> {
  const locale = formString(formData, "locale");
  const requestHeaders = await headers();
  if (!(await captchaOk(formData, requestHeaders))) {
    redirect(waitlistDestination("captcha", locale));
  }
  const parsed = parseWaitlistJoin({ email: formString(formData, "email") });
  if (!parsed.ok) {
    redirect(waitlistDestination(parsed.error, locale));
  }
  if (!(await marketingPublicWriteAllowed(requestHeaders))) {
    redirect(waitlistDestination("rate-limited", locale));
  }

  const { ref } = readGrowthCookies(await cookies());
  const result = await joinWaitlist(growthStore, {
    email: parsed.email,
    referral: ref,
    now: new Date(),
    createId: () => `we_${randomUUID()}`,
    referralCode: generateReferralCode(),
  });

  if (result.outcome === "created") {
    await recordAuditEvent({
      action: AUDIT_ACTIONS.waitlistJoined,
      metadata: { referred: Boolean(ref) },
      targetId: parsed.email,
      targetType: "waitlist_entry",
    });
  }

  if (result.outcome === "duplicate") {
    redirect(waitlistDestination("duplicate", locale));
  }
  redirect(
    waitlistDestination("joined", locale, {
      position: String(result.position),
      code: result.referralCode,
    }),
  );
}

function adminDestination(status: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams({ status, ...extra });
  return `/admin/waitlist?${params.toString()}`;
}

function adminMailer() {
  return {
    send: async (message: {
      to: string;
      subject: string;
      text: string;
      footer: string;
      lang: string;
    }) => {
      await transactionalMail.send({
        category: "transactional",
        footer: message.footer,
        lang: message.lang,
        subject: message.subject,
        text: message.text,
        to: message.to,
        // Pre-auth recipients own no workspace row yet — same convention as OTP.
        workspaceId: "pre-auth",
      });
    },
  };
}

async function adminLocale(): Promise<string> {
  const requestHeaders = await headers();
  return requestHeaders.get("x-supastack-locale") ?? "en";
}

function parseExpiryDays(formData: FormData): Date | null {
  const days = Number(formString(formData, "expiresInDays"));
  if (!Number.isFinite(days) || days <= 0 || days > 365) {
    return null;
  }
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/** Invite one waitlist entry: mint an email-bound code and send it. */
export async function inviteWaitlistEntryAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const entryId = formString(formData, "entryId");
  const entry = entryId ? await growthStore.findWaitlistEntryById(entryId) : null;
  if (!entry) {
    redirect(adminDestination("missing-entry"));
  }
  if (entry.status === "joined") {
    redirect(adminDestination("already-joined"));
  }

  const { outcome, code } = await issueEarlyAccessInvite(growthStore, entry, {
    adminUserId: session.user.id,
    appUrl: serverConfig.app.webUrl,
    locale: await adminLocale(),
    now: new Date(),
    send: adminMailer().send,
    createCode: generateInviteCode,
    createId: () => `eac_${randomUUID()}`,
    expiresAt: parseExpiryDays(formData),
  });

  await recordAuditEvent({
    action: AUDIT_ACTIONS.waitlistInvited,
    actorUserId: session.user.id,
    metadata: { code, mailOutcome: outcome },
    targetId: entry.email,
    targetType: "waitlist_entry",
  });
  redirect(adminDestination(outcome === "sent" ? "invited" : "invite-failed"));
}

/** Invite the next N waiting entries — referral count desc, then oldest. */
export async function inviteWaitlistBatchAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const rawCount = Number(formString(formData, "count"));
  const count = Number.isFinite(rawCount) ? Math.min(Math.max(Math.floor(rawCount), 1), 500) : 10;

  const result = await inviteWaitlistEntries(growthStore, {
    count,
    adminUserId: session.user.id,
    appUrl: serverConfig.app.webUrl,
    locale: await adminLocale(),
    now: new Date(),
    send: adminMailer().send,
    createCode: generateInviteCode,
    createId: () => `eac_${randomUUID()}`,
    expiresAt: parseExpiryDays(formData),
  });

  await recordAuditEvent({
    action: AUDIT_ACTIONS.waitlistInvited,
    actorUserId: session.user.id,
    metadata: { invited: result.invited, failed: result.failed.length, requested: count },
    targetType: "waitlist_entry",
  });
  redirect(
    adminDestination(result.failed.length > 0 ? "invite-partial" : "invited", {
      invited: String(result.invited),
      failed: String(result.failed.length),
    }),
  );
}

/** Remove a waitlist entry (GDPR-style delete; referral ledger stays append-only). */
export async function removeWaitlistEntryAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const entryId = formString(formData, "entryId");
  if (!entryId) {
    redirect(adminDestination("missing-entry"));
  }
  const entry = await growthStore.findWaitlistEntryById(entryId);
  await growthStore.deleteWaitlistEntry(entryId);
  await recordAuditEvent({
    action: AUDIT_ACTIONS.waitlistRemoved,
    actorUserId: session.user.id,
    metadata: { email: entry?.email ?? "unknown" },
    targetId: entryId,
    targetType: "waitlist_entry",
  });
  redirect(adminDestination("removed"));
}

/** Mint a standalone early-access code (optionally email-bound or expiring). */
export async function createEarlyAccessCodeAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const rawEmail = formString(formData, "email").trim();
  const email = rawEmail ? normalizeWaitlistEmail(rawEmail) : null;
  if (rawEmail && !email) {
    redirect(adminDestination("invalid-email"));
  }
  const code = generateInviteCode();
  await growthStore.createEarlyAccessCode({
    id: `eac_${randomUUID()}`,
    code,
    email,
    waitlistEntryId: null,
    createdByUserId: session.user.id,
    redeemedByUserId: null,
    redeemedAt: null,
    expiresAt: parseExpiryDays(formData),
  });
  await recordAuditEvent({
    action: AUDIT_ACTIONS.earlyAccessCodeCreated,
    actorUserId: session.user.id,
    metadata: { email },
    targetId: code,
    targetType: "early_access_code",
  });
  redirect(adminDestination("code-created", { code }));
}
