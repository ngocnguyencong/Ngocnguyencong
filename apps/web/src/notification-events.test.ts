import { describe, expect, it } from "vitest";
import { getDictionary } from "@supastack/i18n";

import {
  billingEventFromEntitlement,
  emailCategoryForEvent,
  notificationCopyForEvent,
  planWorkspaceNotifications,
  shouldDeliverEmailNotification,
  shouldDeliverInAppNotification,
  type NotificationProductEvent,
} from "./notification-events.js";

describe("notification product events", () => {
  const now = () => new Date("2026-09-10T15:00:00.000Z");
  let id = 0;
  const createId = () => `ntf_${++id}`;

  it("builds billing success and failure copy with billing href", () => {
    expect(
      notificationCopyForEvent({ type: "billing.checkout_succeeded", workspaceId: "ws_1" }),
    ).toEqual({
      title: "Subscription active",
      body: "Billing entitlement is now active for this workspace.",
      href: "/billing",
    });
    expect(
      notificationCopyForEvent({ type: "billing.payment_failed", workspaceId: "ws_1" }),
    ).toMatchObject({
      title: "Payment failed",
      href: "/billing",
    });
    expect(
      notificationCopyForEvent({ type: "billing.subscription_ended", workspaceId: "ws_1" }),
    ).toMatchObject({
      title: "Subscription ended",
      href: "/billing",
    });
  });

  it("builds AI budget and invite-accepted copy", () => {
    expect(notificationCopyForEvent({ type: "ai.budget_exceeded", workspaceId: "ws_1" })).toEqual({
      title: "AI budget reached",
      body: "This workspace hit its monthly AI budget. New provider attempts are blocked until the period resets or the limit changes.",
      href: "/ai",
    });
    expect(
      notificationCopyForEvent({
        type: "invite.accepted",
        workspaceId: "ws_1",
        memberEmail: "alex@example.com",
      }),
    ).toEqual({
      title: "Invite accepted",
      body: "alex@example.com joined this workspace.",
      href: "/settings/members",
    });
  });

  it("builds member left and role-changed copy and localizes event titles", () => {
    expect(
      notificationCopyForEvent({
        type: "member.left",
        workspaceId: "ws_1",
        memberEmail: "alex@example.com",
      }),
    ).toEqual({
      title: "Member left",
      body: "alex@example.com left this workspace.",
      href: "/settings/members",
    });
    expect(
      notificationCopyForEvent({
        type: "member.removed",
        workspaceId: "ws_1",
        memberEmail: "alex@example.com",
      }),
    ).toEqual({
      title: "Member removed",
      body: "alex@example.com was removed from this workspace.",
      href: "/settings/members",
    });
    expect(
      notificationCopyForEvent({
        type: "member.role_changed",
        workspaceId: "ws_1",
        memberEmail: "alex@example.com",
        role: "admin",
      }),
    ).toEqual({
      title: "Role updated",
      body: "alex@example.com is now admin.",
      href: "/settings/members",
    });
    expect(
      notificationCopyForEvent({ type: "billing.payment_failed", workspaceId: "ws_1" }, "de").title,
    ).toBe(getDictionary("de").notificationEvents.paymentFailed.title);
  });

  it("builds connected-account reauth copy and keeps the event in-app only", () => {
    const event: NotificationProductEvent = {
      accountLabel: "@acme",
      type: "connected_account.token_refresh_failed",
      workspaceId: "ws_1",
    };

    const copy = notificationCopyForEvent(event);
    expect(copy).toEqual({
      title: getDictionary("en").notificationEvents.connectedAccountReauth.title,
      body: getDictionary("en").notificationEvents.connectedAccountReauth.body("@acme"),
      href: "/settings/connections",
    });
    expect(copy.body).toContain("@acme");

    // In-app only: no email preference category exists for this event, so it
    // must never attempt an email send regardless of member preferences.
    expect(emailCategoryForEvent(event)).toBeNull();
    expect(
      shouldDeliverEmailNotification(event, {
        emailBilling: true,
        emailInvites: true,
        inAppProduct: true,
      }),
    ).toBe(false);
    expect(shouldDeliverInAppNotification(null)).toBe(true);
  });

  it("gates in-app delivery on inAppProduct only", () => {
    expect(
      shouldDeliverInAppNotification({
        emailBilling: false,
        emailInvites: false,
        inAppProduct: true,
      }),
    ).toBe(true);
    expect(
      shouldDeliverInAppNotification({
        emailBilling: true,
        emailInvites: true,
        inAppProduct: false,
      }),
    ).toBe(false);
  });

  it("plans one notification per eligible workspace member", () => {
    const event: NotificationProductEvent = {
      type: "billing.checkout_succeeded",
      workspaceId: "ws_1",
    };
    const planned = planWorkspaceNotifications({
      createId,
      event,
      members: [{ userId: "user_a" }, { userId: "user_b" }, { userId: "user_c" }],
      now,
      preferencesByUserId: {
        user_a: { emailBilling: true, emailInvites: true, inAppProduct: true },
        user_b: { emailBilling: true, emailInvites: true, inAppProduct: false },
        // user_c missing prefs → defaults allow in-app
      },
    });

    expect(planned).toHaveLength(2);
    expect(planned.map((row) => row.userId).sort()).toEqual(["user_a", "user_c"]);
    expect(planned.every((row) => row.workspaceId === "ws_1" && row.readAt === null)).toBe(true);
    expect(planned[0]?.title).toBe("Subscription active");
  });

  it("can exclude the actor when planning invite-accepted notifications", () => {
    const planned = planWorkspaceNotifications({
      createId,
      event: {
        type: "invite.accepted",
        workspaceId: "ws_1",
        memberEmail: "new@example.com",
      },
      excludeUserIds: ["user_new"],
      members: [{ userId: "user_owner" }, { userId: "user_new" }],
      now,
      preferencesByUserId: {},
    });
    expect(planned).toHaveLength(1);
    expect(planned[0]?.userId).toBe("user_owner");
  });

  it("maps billing entitlement status onto product events", () => {
    expect(billingEventFromEntitlement("ws_1", "active")).toEqual({
      type: "billing.checkout_succeeded",
      workspaceId: "ws_1",
    });
    expect(billingEventFromEntitlement("ws_1", "trialing")).toEqual({
      type: "billing.checkout_succeeded",
      workspaceId: "ws_1",
    });
    expect(billingEventFromEntitlement("ws_1", "past_due")).toEqual({
      type: "billing.payment_failed",
      workspaceId: "ws_1",
    });
    expect(billingEventFromEntitlement("ws_1", "inactive")).toEqual({
      type: "billing.subscription_ended",
      workspaceId: "ws_1",
    });
  });
});
