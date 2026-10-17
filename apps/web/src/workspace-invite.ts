import { DEFAULT_LOCALE, getDictionary, isAppLocale } from "@supastack/i18n";

export type InviteAcceptanceInput = Readonly<{
  invitation: Readonly<{
    email: string;
    expiresAt: Date;
    status: string;
    workspaceId: string;
    role: string;
  }> | null;
  now: Date;
  sessionEmail: string;
}>;

export type InviteAcceptanceResult =
  | Readonly<{ ok: true; role: string; workspaceId: string }>
  | Readonly<{
      ok: false;
      reason: "missing" | "not-pending" | "expired" | "email-mismatch";
    }>;

export function evaluateInviteAcceptance(input: InviteAcceptanceInput): InviteAcceptanceResult {
  if (input.invitation === null) {
    return { ok: false, reason: "missing" };
  }
  if (input.invitation.status !== "pending") {
    return { ok: false, reason: "not-pending" };
  }
  if (input.invitation.expiresAt.getTime() <= input.now.getTime()) {
    return { ok: false, reason: "expired" };
  }
  if (input.invitation.email.trim().toLowerCase() !== input.sessionEmail.trim().toLowerCase()) {
    return { ok: false, reason: "email-mismatch" };
  }
  return {
    ok: true,
    role: input.invitation.role,
    workspaceId: input.invitation.workspaceId,
  };
}

export function buildWorkspaceInviteEmail(input: {
  acceptUrl: string;
  inviterEmail: string;
  workspaceName: string;
  locale?: string | null | undefined;
}): { footer: string; lang: string; subject: string; text: string } {
  const locale = isAppLocale(input.locale) ? input.locale : DEFAULT_LOCALE;
  const copy = getDictionary(locale);
  return {
    footer: copy.mail.transactionalFooter,
    lang: locale,
    subject: copy.mail.inviteSubject,
    text: `${input.inviterEmail}\n\n${copy.mail.inviteBody(input.workspaceName, input.acceptUrl)}\n\nIf you did not expect this email, ignore it.`,
  };
}

export type WorkspaceSeatLimitInput = Readonly<{
  memberCount: number;
  pendingInviteCount: number;
  seatLimit: number | null;
}>;

export type WorkspaceSeatLimitDecision =
  | Readonly<{ allowed: true; currentSeats: number; remainingSeats: number | null }>
  | Readonly<{
      allowed: false;
      currentSeats: number;
      remainingSeats: 0;
      reason: "seat-limit-exceeded";
    }>;

export function evaluateWorkspaceSeatLimit(
  input: WorkspaceSeatLimitInput,
): WorkspaceSeatLimitDecision {
  const currentSeats = Math.max(0, input.memberCount) + Math.max(0, input.pendingInviteCount);
  if (input.seatLimit === null) {
    return { allowed: true, currentSeats, remainingSeats: null };
  }
  if (currentSeats >= input.seatLimit) {
    return {
      allowed: false,
      currentSeats,
      remainingSeats: 0,
      reason: "seat-limit-exceeded",
    };
  }
  return {
    allowed: true,
    currentSeats,
    remainingSeats: Math.max(0, input.seatLimit - currentSeats),
  };
}

/** A live invitation already occupies one seat, so acceptance only needs to
 * reject workspaces that were oversubscribed before that reservation existed. */
export function canAcceptWorkspaceSeatReservation(input: WorkspaceSeatLimitInput): boolean {
  const currentSeats = Math.max(0, input.memberCount) + Math.max(0, input.pendingInviteCount);
  return input.seatLimit === null || currentSeats <= input.seatLimit;
}

export function workspaceSeatLimitForPriceReference(
  priceReference: string | null | undefined,
): number | null {
  if (priceReference === undefined || priceReference === null) {
    return 1;
  }

  const normalized = priceReference.toLowerCase();
  if (normalized.includes("enterprise")) {
    return null;
  }
  if (normalized.includes("business")) {
    return 20;
  }
  if (normalized.includes("lifetime") || normalized.includes("pro")) {
    return 5;
  }
  return 5;
}
