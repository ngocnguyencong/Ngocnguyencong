import { describe, expect, it } from "vitest";

import {
  createNotificationPreferenceRecord,
  createNotificationRecord,
  DEFAULT_NOTIFICATION_PREFERENCES,
  mergeNotificationPreferences,
} from "./notifications.js";

describe("notifications helpers", () => {
  const now = () => new Date("2026-09-10T12:00:00.000Z");

  it("creates workspace- and user-scoped notification rows", () => {
    const record = createNotificationRecord({
      body: "Acme invited you",
      createId: () => "ntf_1",
      href: "/invite/token",
      now,
      title: "Invite",
      userId: "user_1",
      workspaceId: "ws_1",
    });

    expect(record).toMatchObject({
      id: "ntf_1",
      workspaceId: "ws_1",
      userId: "user_1",
      title: "Invite",
      href: "/invite/token",
      readAt: null,
    });
  });

  it("rejects empty notification copy", () => {
    expect(() =>
      createNotificationRecord({
        body: " ",
        createId: () => "ntf_x",
        now,
        title: "Hi",
        userId: "user_1",
        workspaceId: "ws_1",
      }),
    ).toThrow(/title and body/i);
  });

  it("defaults preference flags and merges patches", () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES.inAppProduct).toBe(true);
    const prefs = createNotificationPreferenceRecord({
      now,
      userId: "user_1",
      workspaceId: "ws_1",
      flags: { emailBilling: false },
    });
    expect(prefs.emailBilling).toBe(false);
    expect(prefs.emailInvites).toBe(true);
    expect(mergeNotificationPreferences(prefs, { inAppProduct: false }).inAppProduct).toBe(false);
  });
});
