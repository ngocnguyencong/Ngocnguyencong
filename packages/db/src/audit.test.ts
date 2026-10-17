import { describe, expect, it } from "vitest";

import { AUDIT_ACTIONS, createAuditEventRecord, describeAuditEvent } from "./audit";

describe("createAuditEventRecord", () => {
  it("builds an append-only workspace event row", () => {
    const record = createAuditEventRecord(
      { createId: () => "audit_1", now: () => new Date("2026-09-16T00:00:00.000Z") },
      {
        action: AUDIT_ACTIONS.inviteCreated,
        actorUserId: "user_1",
        metadata: { email: "invitee@example.test" },
        targetId: "inv_1",
        targetType: "workspace_invitation",
        workspaceId: "ws_1",
      },
    );

    expect(record).toEqual({
      action: "invite.created",
      actorUserId: "user_1",
      createdAt: new Date("2026-09-16T00:00:00.000Z"),
      id: "audit_1",
      ipAddress: null,
      metadata: { email: "invitee@example.test" },
      targetId: "inv_1",
      targetType: "workspace_invitation",
      workspaceId: "ws_1",
    });
  });

  it("allows platform-level events without a workspace", () => {
    const record = createAuditEventRecord(
      { createId: () => "audit_2", now: () => new Date() },
      {
        action: AUDIT_ACTIONS.adminUserBanned,
        actorUserId: "admin_1",
        targetId: "user_9",
        targetType: "user",
      },
    );

    expect(record.workspaceId).toBeNull();
    expect(record.action).toBe("admin.user_banned");
  });
});

describe("describeAuditEvent", () => {
  it("renders a human label for known actions", () => {
    expect(describeAuditEvent({ action: "invite.created", targetId: "inv_1" })).toBe(
      "Invite created",
    );
    expect(describeAuditEvent({ action: "admin.user_banned" })).toBe("User banned by admin");
    expect(describeAuditEvent({ action: "unknown.thing" })).toBe("unknown.thing");
  });
});
