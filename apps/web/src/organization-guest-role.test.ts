import { describe, expect, it } from "vitest";

import {
  canManageWorkspaceMembers,
  canWriteWorkspace,
  createWorkspaceInvitationRecord,
  evaluateLeaveOrganization,
  evaluateMemberRoleUpdate,
  isWorkspaceReadOnly,
  normalizeWorkspaceRole,
  workspaceRoleAtLeast,
} from "@supastack/db";

import { canManageMembers, isReadOnlyRole } from "./organization-onboarding.js";
import { evaluateInviteAcceptance } from "./workspace-invite.js";

describe("organization guest role parity", () => {
  describe("role hierarchy and permission helpers", () => {
    it("ranks guest below member, admin, and owner", () => {
      expect(workspaceRoleAtLeast("owner", "guest")).toBe(true);
      expect(workspaceRoleAtLeast("admin", "guest")).toBe(true);
      expect(workspaceRoleAtLeast("member", "guest")).toBe(true);
      expect(workspaceRoleAtLeast("guest", "guest")).toBe(true);

      expect(workspaceRoleAtLeast("guest", "member")).toBe(false);
      expect(workspaceRoleAtLeast("guest", "admin")).toBe(false);
      expect(workspaceRoleAtLeast("guest", "owner")).toBe(false);
    });

    it("restricts write and member management permissions for guest role", () => {
      expect(canManageWorkspaceMembers("guest")).toBe(false);
      expect(canManageWorkspaceMembers("member")).toBe(false);
      expect(canManageWorkspaceMembers("admin")).toBe(true);
      expect(canManageWorkspaceMembers("owner")).toBe(true);

      expect(canManageMembers("guest")).toBe(false);
      expect(canManageMembers("member")).toBe(false);
      expect(canManageMembers("admin")).toBe(true);
      expect(canManageMembers("owner")).toBe(true);

      expect(canWriteWorkspace("guest")).toBe(false);
      expect(canWriteWorkspace("member")).toBe(true);
      expect(canWriteWorkspace("admin")).toBe(true);
      expect(canWriteWorkspace("owner")).toBe(true);

      expect(isWorkspaceReadOnly("guest")).toBe(true);
      expect(isWorkspaceReadOnly("member")).toBe(false);
      expect(isWorkspaceReadOnly("admin")).toBe(false);
      expect(isWorkspaceReadOnly("owner")).toBe(false);

      expect(isReadOnlyRole("guest")).toBe(true);
      expect(isReadOnlyRole("member")).toBe(false);
    });

    it("normalizes guest role and viewer alias", () => {
      expect(normalizeWorkspaceRole("guest")).toBe("guest");
      expect(normalizeWorkspaceRole("viewer")).toBe("guest");
      expect(normalizeWorkspaceRole("  GUEST  ")).toBe("guest");
      expect(normalizeWorkspaceRole("  Viewer  ")).toBe("guest");
      expect(normalizeWorkspaceRole("admin")).toBe("admin");
      expect(normalizeWorkspaceRole("owner")).toBe("owner");
      expect(normalizeWorkspaceRole("member")).toBe("member");
      expect(normalizeWorkspaceRole("unknown_role")).toBe("member");
    });
  });

  describe("invitation with guest role", () => {
    it("creates a pending invitation with role guest", () => {
      const now = new Date("2026-09-11T12:00:00.000Z");
      const invitation = createWorkspaceInvitationRecord({
        createId: (kind) => `${kind}_guest_01`,
        email: "guest.auditor@example.com",
        expiresAt: new Date("2026-09-18T12:00:00.000Z"),
        invitedByUserId: "user_owner",
        now: () => now,
        role: "guest",
        token: "tok_guest_01",
        workspaceId: "workspace_org",
      });

      expect(invitation.role).toBe("guest");
      expect(invitation.status).toBe("pending");
      expect(invitation.email).toBe("guest.auditor@example.com");
    });

    it("accepts a guest invitation preserving guest role", () => {
      const now = new Date("2026-09-11T12:00:00.000Z");
      const result = evaluateInviteAcceptance({
        invitation: {
          email: "auditor@example.com",
          expiresAt: new Date("2026-09-18T12:00:00.000Z"),
          role: "guest",
          status: "pending",
          workspaceId: "workspace_org",
        },
        now,
        sessionEmail: "auditor@example.com",
      });

      expect(result).toEqual({
        ok: true,
        role: "guest",
        workspaceId: "workspace_org",
      });
    });
  });

  describe("role updates to and from guest", () => {
    it("allows admin or owner to assign guest role to a member", () => {
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
          actorRole: "owner",
          nextRole: "guest",
          ownerCount: 2,
          targetIsSelf: false,
          targetRole: "admin",
        }),
      ).toEqual({ ok: true });
    });

    it("allows promoting a guest to member or admin", () => {
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
          actorRole: "owner",
          nextRole: "admin",
          ownerCount: 1,
          targetIsSelf: false,
          targetRole: "guest",
        }),
      ).toEqual({ ok: true });
    });

    it("prevents guest from updating any member roles", () => {
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
          actorRole: "guest",
          nextRole: "admin",
          ownerCount: 1,
          targetIsSelf: false,
          targetRole: "member",
        }),
      ).toEqual({ ok: false, reason: "forbidden" });
    });

    it("prevents demoting a sole owner to guest", () => {
      expect(
        evaluateMemberRoleUpdate({
          actorRole: "owner",
          nextRole: "guest",
          ownerCount: 1,
          targetIsSelf: false,
          targetRole: "owner",
        }),
      ).toEqual({ ok: false, reason: "sole-owner" });
    });

    it("returns unchanged when updating guest to guest", () => {
      expect(
        evaluateMemberRoleUpdate({
          actorRole: "owner",
          nextRole: "guest",
          ownerCount: 1,
          targetIsSelf: false,
          targetRole: "guest",
        }),
      ).toEqual({ ok: false, reason: "unchanged" });
    });
  });

  describe("leaving organization as guest", () => {
    it("allows a guest to leave an organization", () => {
      expect(
        evaluateLeaveOrganization({
          actorRole: "guest",
          ownerCount: 1,
          workspaceType: "organization",
        }),
      ).toEqual({ ok: true });
    });

    it("blocks leaving a personal workspace as guest", () => {
      expect(
        evaluateLeaveOrganization({
          actorRole: "guest",
          ownerCount: 1,
          workspaceType: "personal",
        }),
      ).toEqual({ ok: false, reason: "personal" });
    });
  });

  describe("UI markup contracts for guest role", () => {
    it("includes guest options and read-only indicators in member settings UI", async () => {
      const { readFileSync } = await import("node:fs");
      const { dirname, join } = await import("node:path");
      const { fileURLToPath } = await import("node:url");

      const here = dirname(fileURLToPath(import.meta.url));
      const settingsSrc = readFileSync(join(here, "web-settings-page.tsx"), "utf8");
      const orgSettingsSrc = readFileSync(
        join(here, "../app/organization/settings/page.tsx"),
        "utf8",
      );

      // Members settings includes guest role in dropdowns and displays
      expect(settingsSrc).toContain('<option value="guest">guest</option>');
      expect(settingsSrc).toContain('id="invite-role"');
      expect(settingsSrc).toContain("members and guests can leave");
      expect(settingsSrc).toContain(
        'member.role === "guest" ? <span className="quiet-note"> (read-only)</span>',
      );

      // Org settings acknowledges guest read-only access
      expect(orgSettingsSrc).toContain('actorRole === "guest"');
      expect(orgSettingsSrc).toContain("guest (read-only) permissions");
    });
  });
});
