import { describe, expect, it } from "vitest";

import { markNotificationReadRecord } from "./notification-mark-read.js";

describe("mark notification read", () => {
  const now = () => new Date("2026-09-10T17:00:00.000Z");

  it("sets readAt when the row belongs to the same user and workspace", () => {
    expect(
      markNotificationReadRecord({
        notification: {
          id: "ntf_1",
          userId: "user_1",
          workspaceId: "ws_1",
          readAt: null,
        },
        now,
        sessionUserId: "user_1",
        workspaceId: "ws_1",
      }),
    ).toEqual({
      id: "ntf_1",
      readAt: new Date("2026-09-10T17:00:00.000Z"),
      updatedAt: new Date("2026-09-10T17:00:00.000Z"),
    });
  });

  it("rejects foreign workspace or user rows", () => {
    expect(
      markNotificationReadRecord({
        notification: {
          id: "ntf_1",
          userId: "user_2",
          workspaceId: "ws_1",
          readAt: null,
        },
        now,
        sessionUserId: "user_1",
        workspaceId: "ws_1",
      }),
    ).toBeNull();
  });

  it("is idempotent when already read", () => {
    const readAt = new Date("2026-09-09T12:00:00.000Z");
    expect(
      markNotificationReadRecord({
        notification: {
          id: "ntf_1",
          userId: "user_1",
          workspaceId: "ws_1",
          readAt,
        },
        now,
        sessionUserId: "user_1",
        workspaceId: "ws_1",
      }),
    ).toEqual({ id: "ntf_1", readAt, updatedAt: readAt });
  });
});
