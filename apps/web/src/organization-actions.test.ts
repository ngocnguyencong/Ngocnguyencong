import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { evaluateWorkspaceSeatLimit } from "./workspace-invite.js";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");

function readWeb(relativePath: string): string {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("organization invite seat limit enforcement", () => {
  it("enforces seat limits during invite action", () => {
    const actions = readWeb("src/organization-actions.ts");
    expect(actions).toContain("getWorkspaceSeatLimit");
    expect(actions).toContain("evaluateWorkspaceSeatLimit");
    expect(actions).toContain("status=seat-limit-exceeded");
    expect(actions).toContain('reason: "already-member"');
    expect(actions).toContain('reason: "already-invited"');
    expect(actions).toContain("redirect(`/settings/members?status=${status}`)");
  });

  it("evaluates seat limit boundary conditions correctly", () => {
    // Under limit
    expect(
      evaluateWorkspaceSeatLimit({ memberCount: 1, pendingInviteCount: 0, seatLimit: 5 }),
    ).toEqual({ allowed: true, currentSeats: 1, remainingSeats: 4 });

    // At limit
    expect(
      evaluateWorkspaceSeatLimit({ memberCount: 3, pendingInviteCount: 2, seatLimit: 5 }),
    ).toEqual({
      allowed: false,
      currentSeats: 5,
      remainingSeats: 0,
      reason: "seat-limit-exceeded",
    });

    // Over limit
    expect(
      evaluateWorkspaceSeatLimit({ memberCount: 4, pendingInviteCount: 2, seatLimit: 5 }),
    ).toEqual({
      allowed: false,
      currentSeats: 6,
      remainingSeats: 0,
      reason: "seat-limit-exceeded",
    });

    // Unlimited
    expect(
      evaluateWorkspaceSeatLimit({ memberCount: 100, pendingInviteCount: 20, seatLimit: null }),
    ).toEqual({ allowed: true, currentSeats: 120, remainingSeats: null });
  });

  it("exposes seat count and limit in active organization members list", () => {
    const actions = readWeb("src/organization-actions.ts");
    expect(actions).toContain("seatCount: members.length + pendingInviteCount");
    expect(actions).toContain("seatLimit,");
  });

  it("displays seat usage and disables invite when limit reached in web-settings-page", () => {
    const settings = readWeb("src/web-settings-page.tsx");
    expect(settings).toContain("isSeatLimitReached");
    expect(settings).toContain("Seat limit reached");
    expect(settings).toContain('status === "seat-limit-exceeded"');
    expect(settings).toContain('status === "already-member"');
    expect(settings).toContain('status === "already-invited"');
  });
});

describe("pending invitation management and member removal", () => {
  it("exposes revoke, resend, and remove server actions with role guards", () => {
    const actions = readWeb("src/organization-actions.ts");
    expect(actions).toContain("export async function revokeWorkspaceInviteAction");
    expect(actions).toContain("export async function resendWorkspaceInviteAction");
    expect(actions).toContain("export async function removeMemberAction");
    expect(actions).toContain("evaluateInviteRevocation");
    expect(actions).toContain("evaluateInviteResend");
    expect(actions).toContain("evaluateMemberRemoval");
    expect(actions).toContain("canManageWorkspaceMembers");
    expect(actions).toContain('"member.removed"');
    expect(actions).toContain("status=invite-revoked");
    expect(actions).toContain("status=invite-resent");
    expect(actions).toContain("status=member-removed");
    expect(actions).toContain("pendingInvitations");
  });

  it("lists pending invitations and member removal controls in members settings", () => {
    const settings = readWeb("src/web-settings-page.tsx");
    expect(settings).toContain("Pending invitations");
    expect(settings).toContain("revokeWorkspaceInviteAction");
    expect(settings).toContain("resendWorkspaceInviteAction");
    expect(settings).toContain("removeMemberAction");
    expect(settings).toContain('status === "invite-revoked"');
    expect(settings).toContain('status === "invite-resent"');
    expect(settings).toContain('status === "member-removed"');
    expect(settings).toContain('status === "use-leave"');
  });

  it("resend rotates the token only when the invitation expired", () => {
    const actions = readWeb("src/organization-actions.ts");
    expect(actions).toContain("decision.rotateToken");
    expect(actions).toContain('randomBytes(24).toString("base64url")');
    expect(actions).toContain("buildWorkspaceInviteEmail");
  });
});
