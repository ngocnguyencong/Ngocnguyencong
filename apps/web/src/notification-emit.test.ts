import { describe, expect, it, vi } from "vitest";

import { emitWorkspaceProductNotification } from "./notification-emit.js";

describe("notification emit runtime", () => {
  it("inserts planned rows for eligible members and skips preference denials", async () => {
    const insertNotification = vi.fn(async () => undefined);
    const listMemberUserIds = vi.fn(async () => ["owner_1", "member_2"]);
    const readPreferences = vi.fn(async (userId: string) =>
      userId === "member_2"
        ? { emailBilling: true, emailInvites: true, inAppProduct: false }
        : { emailBilling: true, emailInvites: true, inAppProduct: true },
    );

    const result = await emitWorkspaceProductNotification(
      { type: "ai.budget_exceeded", workspaceId: "ws_budget" },
      {
        createId: () => "ntf_emit_1",
        insertNotification,
        listMemberUserIds,
        now: () => new Date("2026-09-10T16:00:00.000Z"),
        readPreferences,
      },
    );

    expect(listMemberUserIds).toHaveBeenCalledWith("ws_budget");
    expect(result.inserted).toBe(1);
    expect(insertNotification).toHaveBeenCalledTimes(1);
    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ntf_emit_1",
        userId: "owner_1",
        workspaceId: "ws_budget",
        title: "AI budget reached",
        readAt: null,
      }),
    );
  });

  it("returns zero inserts when the workspace has no members", async () => {
    const insertNotification = vi.fn(async () => undefined);
    const result = await emitWorkspaceProductNotification(
      {
        type: "invite.accepted",
        workspaceId: "ws_empty",
        memberEmail: "new@example.com",
      },
      {
        createId: () => "ntf_x",
        insertNotification,
        listMemberUserIds: async () => [],
        now: () => new Date(),
        readPreferences: async () => null,
      },
    );
    expect(result.inserted).toBe(0);
    expect(insertNotification).not.toHaveBeenCalled();
  });
});

describe("notification email fan-out", () => {
  it("sends transactional email to members whose email preference allows the category", async () => {
    const sent: Array<{ to: string; subject: string }> = [];
    const result = await emitWorkspaceProductNotification(
      { type: "billing.payment_failed", workspaceId: "ws_bill" },
      {
        createId: () => "ntf_e1",
        getMemberEmail: async (userId) =>
          userId === "owner_1" ? "owner@example.com" : "member@example.com",
        insertNotification: async () => undefined,
        listMemberUserIds: async () => ["owner_1", "member_2"],
        now: () => new Date("2026-09-10T16:00:00.000Z"),
        readPreferences: async (userId) =>
          userId === "member_2"
            ? { emailBilling: false, emailInvites: true, inAppProduct: true }
            : { emailBilling: true, emailInvites: true, inAppProduct: true },
        sendEmail: async (input) => {
          sent.push({ subject: input.subject, to: input.to });
        },
      },
    );

    expect(result.inserted).toBe(2);
    expect(sent).toEqual([{ subject: "Payment failed", to: "owner@example.com" }]);
  });

  it("pushes only to members who received an in-app row and survives sender failure", async () => {
    const pushed: Array<{ href?: string; userId: string }> = [];
    const result = await emitWorkspaceProductNotification(
      { type: "billing.payment_failed", workspaceId: "ws_bill" },
      {
        createId: () => "ntf_p1",
        insertNotification: async () => undefined,
        listMemberUserIds: async () => ["owner_1", "member_2"],
        now: () => new Date("2026-09-10T16:00:00.000Z"),
        readPreferences: async (userId) =>
          userId === "member_2"
            ? { emailBilling: true, emailInvites: true, inAppProduct: false }
            : { emailBilling: true, emailInvites: true, inAppProduct: true },
        sendPush: async (input) => {
          pushed.push({
            userId: input.userId,
            ...(typeof input.data?.href === "string" ? { href: input.data.href } : {}),
          });
          throw new Error("expo down");
        },
      },
    );

    expect(result.inserted).toBe(1);
    expect(pushed).toEqual([{ href: "/billing", userId: "owner_1" }]);
  });

  it("does not email ai.budget_exceeded (in-app only) and survives sender failure", async () => {
    const sent: string[] = [];
    const result = await emitWorkspaceProductNotification(
      { type: "ai.budget_exceeded", workspaceId: "ws_ai" },
      {
        createId: () => "ntf_e2",
        getMemberEmail: async () => "user@example.com",
        insertNotification: async () => undefined,
        listMemberUserIds: async () => ["owner_1"],
        now: () => new Date(),
        readPreferences: async () => ({
          emailBilling: true,
          emailInvites: true,
          inAppProduct: true,
        }),
        sendEmail: async (input) => {
          sent.push(input.to);
          throw new Error("smtp down");
        },
      },
    );
    expect(result.inserted).toBe(1);
    expect(sent).toEqual([]);
  });
});
