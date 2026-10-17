import {
  createNotificationRecord,
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferenceFlags,
} from "@supastack/db";
import { DEFAULT_LOCALE, getDictionary, isAppLocale, type AppLocale } from "@supastack/i18n";

export type NotificationProductEvent =
  | Readonly<{ type: "billing.checkout_succeeded"; workspaceId: string }>
  | Readonly<{ type: "billing.payment_failed"; workspaceId: string }>
  | Readonly<{ type: "billing.subscription_ended"; workspaceId: string }>
  | Readonly<{ type: "ai.budget_exceeded"; workspaceId: string }>
  | Readonly<{
      type: "connected_account.token_refresh_failed";
      workspaceId: string;
      accountLabel: string;
    }>
  | Readonly<{
      type: "invite.accepted";
      workspaceId: string;
      memberEmail: string;
    }>
  | Readonly<{
      type: "member.left";
      workspaceId: string;
      memberEmail: string;
    }>
  | Readonly<{
      type: "member.removed";
      workspaceId: string;
      memberEmail: string;
    }>
  | Readonly<{
      type: "member.role_changed";
      workspaceId: string;
      memberEmail: string;
      role: string;
    }>;

export type NotificationCopy = Readonly<{
  body: string;
  href: string;
  title: string;
}>;

function resolveCopyLocale(locale?: string | null): AppLocale {
  return isAppLocale(locale) ? locale : DEFAULT_LOCALE;
}

export function billingEventFromEntitlement(
  workspaceId: string,
  entitlementStatus: "active" | "trialing" | "past_due" | "inactive",
): NotificationProductEvent {
  if (entitlementStatus === "active" || entitlementStatus === "trialing") {
    return { type: "billing.checkout_succeeded", workspaceId };
  }
  if (entitlementStatus === "past_due") {
    return { type: "billing.payment_failed", workspaceId };
  }
  return { type: "billing.subscription_ended", workspaceId };
}

export function notificationCopyForEvent(
  event: NotificationProductEvent,
  locale?: string | null,
): NotificationCopy {
  const events = getDictionary(resolveCopyLocale(locale)).notificationEvents;
  switch (event.type) {
    case "billing.checkout_succeeded":
      return {
        title: events.checkoutSucceeded.title,
        body: events.checkoutSucceeded.body,
        href: "/billing",
      };
    case "billing.payment_failed":
      return {
        title: events.paymentFailed.title,
        body: events.paymentFailed.body,
        href: "/billing",
      };
    case "billing.subscription_ended":
      return {
        title: events.subscriptionEnded.title,
        body: events.subscriptionEnded.body,
        href: "/billing",
      };
    case "ai.budget_exceeded":
      return {
        title: events.budgetExceeded.title,
        body: events.budgetExceeded.body,
        href: "/ai",
      };
    case "connected_account.token_refresh_failed":
      return {
        title: events.connectedAccountReauth.title,
        body: events.connectedAccountReauth.body(event.accountLabel),
        href: "/settings/connections",
      };
    case "invite.accepted":
      return {
        title: events.inviteAccepted.title,
        body: events.inviteAccepted.body(event.memberEmail),
        href: "/settings/members",
      };
    case "member.left":
      return {
        title: events.memberLeft.title,
        body: events.memberLeft.body(event.memberEmail),
        href: "/settings/members",
      };
    case "member.removed":
      return {
        title: events.memberRemoved.title,
        body: events.memberRemoved.body(event.memberEmail),
        href: "/settings/members",
      };
    case "member.role_changed":
      return {
        title: events.memberRoleChanged.title,
        body: events.memberRoleChanged.body(event.memberEmail, event.role),
        href: "/settings/members",
      };
  }
}

export function shouldDeliverInAppNotification(
  preferences: NotificationPreferenceFlags | null | undefined,
): boolean {
  return (preferences ?? DEFAULT_NOTIFICATION_PREFERENCES).inAppProduct;
}

/**
 * Maps a product event onto its email preference category. `ai.budget_exceeded`
 * and `connected_account.token_refresh_failed` are in-app only; there is no
 * product email toggle for them yet.
 */
export function emailCategoryForEvent(
  event: NotificationProductEvent,
): "billing" | "invites" | null {
  if (event.type.startsWith("billing.")) {
    return "billing";
  }
  if (event.type === "invite.accepted" || event.type.startsWith("member.")) {
    return "invites";
  }
  return null;
}

export function shouldDeliverEmailNotification(
  event: NotificationProductEvent,
  preferences: NotificationPreferenceFlags | null | undefined,
): boolean {
  const category = emailCategoryForEvent(event);
  if (category === null) {
    return false;
  }
  const prefs = preferences ?? DEFAULT_NOTIFICATION_PREFERENCES;
  return category === "billing" ? prefs.emailBilling : prefs.emailInvites;
}

export function planWorkspaceNotifications(input: {
  createId: () => string;
  event: NotificationProductEvent;
  excludeUserIds?: ReadonlyArray<string> | undefined;
  locale?: string | null | undefined;
  members: ReadonlyArray<{ userId: string }>;
  now: () => Date;
  preferencesByUserId: Readonly<Record<string, NotificationPreferenceFlags | null | undefined>>;
}) {
  const excluded = new Set(input.excludeUserIds ?? []);
  const copy = notificationCopyForEvent(input.event, input.locale);
  const rows = [];
  for (const member of input.members) {
    if (excluded.has(member.userId)) {
      continue;
    }
    if (!shouldDeliverInAppNotification(input.preferencesByUserId[member.userId])) {
      continue;
    }
    rows.push(
      createNotificationRecord({
        body: copy.body,
        createId: input.createId,
        href: copy.href,
        now: input.now,
        title: copy.title,
        userId: member.userId,
        workspaceId: input.event.workspaceId,
      }),
    );
  }
  return rows;
}
