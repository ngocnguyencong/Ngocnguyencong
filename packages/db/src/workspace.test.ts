import { describe, expect, it } from "vitest";

import {
  canManageWorkspaceMembers,
  canWriteWorkspace,
  createOrganizationWorkspaceRecords,
  createPersonalWorkspaceRecords,
  createWorkspaceInvitationRecord,
  evaluateInviteResend,
  evaluateInviteRevocation,
  evaluateLeaveOrganization,
  evaluateMemberRemoval,
  evaluateMemberRoleUpdate,
  isWorkspaceReadOnly,
  normalizeWorkspaceRole,
  resolveActiveWorkspaceId,
  workspaceRoleAtLeast,
} from "./workspace.js";

describe("createPersonalWorkspaceRecords", () => {
  it("creates a personal workspace and owner membership with one stable timestamp", () => {
    const now = new Date("2026-09-03T12:00:00.000Z");

    const records = createPersonalWorkspaceRecords({
      createId: (kind) => `${kind}_01`,
      now: () => now,
      userId: "user_01",
      userName: "Noah",
    });

    expect(records.workspace).toEqual({
      id: "workspace_01",
      name: "Noah's workspace",
      slug: "noah-workspace-01",
      type: "personal",
      createdAt: now,
      updatedAt: now,
    });
    expect(records.membership).toEqual({
      id: "membership_01",
      workspaceId: "workspace_01",
      userId: "user_01",
      role: "owner",
      createdAt: now,
      updatedAt: now,
    });
  });

  it("uses a neutral fallback name for blank user names", () => {
    const records = createPersonalWorkspaceRecords({
      createId: (kind) => `${kind}_02`,
      now: () => new Date("2026-09-03T12:00:00.000Z"),
      userId: "user_02",
      userName: "   ",
    });

    expect(records.workspace.name).toBe("My workspace");
    expect(records.workspace.slug).toBe("workspace-02");
  });
});

describe("organization workspaces", () => {
  it("creates an organization workspace owned by the creating user", () => {
    const now = new Date("2026-09-10T18:00:00.000Z");
    const records = createOrganizationWorkspaceRecords({
      createId: (kind) => `${kind}_org`,
      name: "Acme",
      now: () => now,
      userId: "user_01",
    });

    expect(records.workspace).toMatchObject({
      id: "workspace_org",
      name: "Acme",
      type: "organization",
      createdAt: now,
      updatedAt: now,
    });
    expect(records.workspace.slug).toMatch(/^acme-/);
    expect(records.membership).toEqual({
      id: "membership_org",
      workspaceId: "workspace_org",
      userId: "user_01",
      role: "owner",
      createdAt: now,
      updatedAt: now,
    });
  });

  it("builds a pending invitation scoped to the workspace", () => {
    const now = new Date("2026-09-10T18:00:00.000Z");
    const invitation = createWorkspaceInvitationRecord({
      createId: (kind) => `${kind}_inv`,
      email: "  Teammate@Example.COM ",
      expiresAt: new Date("2026-09-17T18:00:00.000Z"),
      invitedByUserId: "user_01",
      now: () => now,
      role: "member",
      token: "invite_token_01",
      workspaceId: "workspace_org",
    });

    expect(invitation).toEqual({
      id: "invitation_inv",
      workspaceId: "workspace_org",
      email: "teammate@example.com",
      role: "member",
      token: "invite_token_01",
      status: "pending",
      invitedByUserId: "user_01",
      expiresAt: new Date("2026-09-17T18:00:00.000Z"),
      createdAt: now,
      updatedAt: now,
    });
  });

  it("orders roles and gates member management", () => {
    expect(workspaceRoleAtLeast("owner", "admin")).toBe(true);
    expect(workspaceRoleAtLeast("admin", "owner")).toBe(false);
    expect(workspaceRoleAtLeast("member", "admin")).toBe(false);
    expect(workspaceRoleAtLeast("guest", "member")).toBe(false);
    expect(workspaceRoleAtLeast("member", "guest")).toBe(true);
    expect(workspaceRoleAtLeast("guest", "guest")).toBe(true);
    expect(canManageWorkspaceMembers("owner")).toBe(true);
    expect(canManageWorkspaceMembers("admin")).toBe(true);
    expect(canManageWorkspaceMembers("member")).toBe(false);
    expect(canManageWorkspaceMembers("guest")).toBe(false);
  });

  it("enforces read-mostly guest permissions vs write-capable roles", () => {
    expect(canWriteWorkspace("owner")).toBe(true);
    expect(canWriteWorkspace("admin")).toBe(true);
    expect(canWriteWorkspace("member")).toBe(true);
    expect(canWriteWorkspace("guest")).toBe(false);

    expect(isWorkspaceReadOnly("guest")).toBe(true);
    expect(isWorkspaceReadOnly("member")).toBe(false);
    expect(isWorkspaceReadOnly("admin")).toBe(false);
    expect(isWorkspaceReadOnly("owner")).toBe(false);
  });

  it("normalizes workspace roles including guest and viewer alias", () => {
    expect(normalizeWorkspaceRole("owner")).toBe("owner");
    expect(normalizeWorkspaceRole("admin")).toBe("admin");
    expect(normalizeWorkspaceRole("member")).toBe("member");
    expect(normalizeWorkspaceRole("guest")).toBe("guest");
    expect(normalizeWorkspaceRole("viewer")).toBe("guest");
    expect(normalizeWorkspaceRole("  GUEST  ")).toBe("guest");
    expect(normalizeWorkspaceRole("  VIEWER  ")).toBe("guest");
    expect(normalizeWorkspaceRole("invalid")).toBe("member");
    expect(normalizeWorkspaceRole(null)).toBe("member");
  });

  it("allows inviting members with the guest role", () => {
    const now = new Date("2026-09-10T18:00:00.000Z");
    const invitation = createWorkspaceInvitationRecord({
      createId: (kind) => `${kind}_inv_guest`,
      email: "guest@example.com",
      expiresAt: new Date("2026-09-17T18:00:00.000Z"),
      invitedByUserId: "user_01",
      now: () => now,
      role: "guest",
      token: "invite_token_guest",
      workspaceId: "workspace_org",
    });

    expect(invitation.role).toBe("guest");
    expect(invitation.status).toBe("pending");
  });

  it("prefers an explicit active workspace when the user still belongs to it", () => {
    expect(
      resolveActiveWorkspaceId({
        activeWorkspaceId: "workspace_org",
        membershipWorkspaceIds: ["workspace_personal", "workspace_org"],
        personalWorkspaceId: "workspace_personal",
      }),
    ).toBe("workspace_org");
    expect(
      resolveActiveWorkspaceId({
        activeWorkspaceId: "workspace_gone",
        membershipWorkspaceIds: ["workspace_personal"],
        personalWorkspaceId: "workspace_personal",
      }),
    ).toBe("workspace_personal");
  });

  it("blocks leaving personal workspaces and sole-owner orgs", () => {
    expect(
      evaluateLeaveOrganization({
        actorRole: "member",
        ownerCount: 1,
        workspaceType: "personal",
      }),
    ).toEqual({ ok: false, reason: "personal" });
    expect(
      evaluateLeaveOrganization({
        actorRole: "owner",
        ownerCount: 1,
        workspaceType: "organization",
      }),
    ).toEqual({ ok: false, reason: "sole-owner" });
    expect(
      evaluateLeaveOrganization({
        actorRole: "owner",
        ownerCount: 2,
        workspaceType: "organization",
      }),
    ).toEqual({ ok: true });
    expect(
      evaluateLeaveOrganization({
        actorRole: "admin",
        ownerCount: 1,
        workspaceType: "organization",
      }),
    ).toEqual({ ok: true });
    expect(
      evaluateLeaveOrganization({
        actorRole: "guest",
        ownerCount: 1,
        workspaceType: "organization",
      }),
    ).toEqual({ ok: true });
    expect(
      evaluateLeaveOrganization({
        actorRole: "guest",
        ownerCount: 1,
        workspaceType: "personal",
      }),
    ).toEqual({ ok: false, reason: "personal" });
  });

  it("gates member role updates so owners stay protected and admins stay below owner", () => {
    expect(
      evaluateMemberRoleUpdate({
        actorRole: "admin",
        nextRole: "admin",
        ownerCount: 1,
        targetIsSelf: false,
        targetRole: "member",
      }),
    ).toEqual({ ok: true });
    expect(
      evaluateMemberRoleUpdate({
        actorRole: "admin",
        nextRole: "guest",
        ownerCount: 1,
        targetIsSelf: false,
        targetRole: "member",
      }),
    ).toEqual({ ok: true });
    expect(
      evaluateMemberRoleUpdate({
        actorRole: "admin",
        nextRole: "member",
        ownerCount: 1,
        targetIsSelf: false,
        targetRole: "guest",
      }),
    ).toEqual({ ok: true });
    expect(
      evaluateMemberRoleUpdate({
        actorRole: "guest",
        nextRole: "member",
        ownerCount: 1,
        targetIsSelf: false,
        targetRole: "guest",
      }),
    ).toEqual({ ok: false, reason: "forbidden" });
    expect(
      evaluateMemberRoleUpdate({
        actorRole: "owner",
        nextRole: "guest",
        ownerCount: 1,
        targetIsSelf: false,
        targetRole: "owner",
      }),
    ).toEqual({ ok: false, reason: "sole-owner" });
    expect(
      evaluateMemberRoleUpdate({
        actorRole: "owner",
        nextRole: "guest",
        ownerCount: 2,
        targetIsSelf: false,
        targetRole: "owner",
      }),
    ).toEqual({ ok: true });
    expect(
      evaluateMemberRoleUpdate({
        actorRole: "owner",
        nextRole: "guest",
        ownerCount: 1,
        targetIsSelf: false,
        targetRole: "guest",
      }),
    ).toEqual({ ok: false, reason: "unchanged" });
    expect(
      evaluateMemberRoleUpdate({
        actorRole: "admin",
        nextRole: "owner",
        ownerCount: 1,
        targetIsSelf: false,
        targetRole: "member",
      }),
    ).toEqual({ ok: false, reason: "forbidden" });
    expect(
      evaluateMemberRoleUpdate({
        actorRole: "owner",
        nextRole: "member",
        ownerCount: 1,
        targetIsSelf: false,
        targetRole: "owner",
      }),
    ).toEqual({ ok: false, reason: "sole-owner" });
    expect(
      evaluateMemberRoleUpdate({
        actorRole: "member",
        nextRole: "admin",
        ownerCount: 1,
        targetIsSelf: false,
        targetRole: "member",
      }),
    ).toEqual({ ok: false, reason: "forbidden" });
    expect(
      evaluateMemberRoleUpdate({
        actorRole: "owner",
        nextRole: "admin",
        ownerCount: 2,
        targetIsSelf: false,
        targetRole: "owner",
      }),
    ).toEqual({ ok: true });
  });

  it("gates member removal so only higher roles remove lower ones and owners stay protected", () => {
    expect(
      evaluateMemberRemoval({
        actorRole: "member",
        ownerCount: 1,
        targetIsSelf: false,
        targetRole: "guest",
      }),
    ).toEqual({ ok: false, reason: "forbidden" });
    expect(
      evaluateMemberRemoval({
        actorRole: "guest",
        ownerCount: 1,
        targetIsSelf: false,
        targetRole: "member",
      }),
    ).toEqual({ ok: false, reason: "forbidden" });
    expect(
      evaluateMemberRemoval({
        actorRole: "owner",
        ownerCount: 2,
        targetIsSelf: true,
        targetRole: "owner",
      }),
    ).toEqual({ ok: false, reason: "self" });
    expect(
      evaluateMemberRemoval({
        actorRole: "admin",
        ownerCount: 2,
        targetIsSelf: false,
        targetRole: "owner",
      }),
    ).toEqual({ ok: false, reason: "forbidden" });
    expect(
      evaluateMemberRemoval({
        actorRole: "admin",
        ownerCount: 2,
        targetIsSelf: false,
        targetRole: "admin",
      }),
    ).toEqual({ ok: false, reason: "forbidden" });
    expect(
      evaluateMemberRemoval({
        actorRole: "admin",
        ownerCount: 1,
        targetIsSelf: false,
        targetRole: "member",
      }),
    ).toEqual({ ok: true });
    expect(
      evaluateMemberRemoval({
        actorRole: "admin",
        ownerCount: 1,
        targetIsSelf: false,
        targetRole: "guest",
      }),
    ).toEqual({ ok: true });
    expect(
      evaluateMemberRemoval({
        actorRole: "owner",
        ownerCount: 1,
        targetIsSelf: false,
        targetRole: "admin",
      }),
    ).toEqual({ ok: true });
    expect(
      evaluateMemberRemoval({
        actorRole: "owner",
        ownerCount: 1,
        targetIsSelf: false,
        targetRole: "owner",
      }),
    ).toEqual({ ok: false, reason: "sole-owner" });
    expect(
      evaluateMemberRemoval({
        actorRole: "owner",
        ownerCount: 2,
        targetIsSelf: false,
        targetRole: "owner",
      }),
    ).toEqual({ ok: true });
  });

  it("gates invite revocation and resend on pending status, rotating expired tokens", () => {
    expect(evaluateInviteRevocation({ status: "pending" })).toEqual({ ok: true });
    expect(evaluateInviteRevocation({ status: "accepted" })).toEqual({
      ok: false,
      reason: "not-pending",
    });
    expect(evaluateInviteRevocation({ status: "revoked" })).toEqual({
      ok: false,
      reason: "not-pending",
    });

    const now = new Date("2026-09-15T12:00:00.000Z");
    expect(
      evaluateInviteResend({
        expiresAt: new Date("2026-09-20T00:00:00.000Z"),
        now,
        status: "pending",
      }),
    ).toEqual({ ok: true, rotateToken: false });
    expect(
      evaluateInviteResend({
        expiresAt: new Date("2026-09-10T00:00:00.000Z"),
        now,
        status: "pending",
      }),
    ).toEqual({ ok: true, rotateToken: true });
    expect(
      evaluateInviteResend({
        expiresAt: new Date("2026-09-20T00:00:00.000Z"),
        now,
        status: "accepted",
      }),
    ).toEqual({ ok: false, reason: "not-pending" });
  });
});
