import { describe, expect, it } from "vitest";

import {
  createMobileOrganizationBff,
  normalizeMobileAssignableRole,
  normalizeMobileInviteRole,
  normalizeMobileOrganizationName,
  type MobileOrganizationContext,
  type MobileOrganizationDependencies,
} from "./mobile-organization-bff";

const MANAGER_CONTEXT: MobileOrganizationContext = {
  role: "owner",
  userId: "user-1",
  workspaceId: "ws-1",
  workspaceName: "Acme Org",
  workspaceType: "organization",
};

const MEMBERS_PAYLOAD = {
  canLeave: true,
  canManage: true,
  currentRole: "owner" as const,
  currentUserId: "user-1",
  members: [{ email: "owner@acme.test", name: "Owner", role: "owner" as const, userId: "user-1" }],
  pendingInvitations: [],
  seatCount: 1,
  seatLimit: 5,
  workspaceId: "ws-1",
  workspaceName: "Acme Org",
};

function makeBff(overrides: Partial<MobileOrganizationDependencies> = {}) {
  const deps: MobileOrganizationDependencies = {
    acceptInvite: async () => ({ ok: true, workspaceId: "ws-2" }),
    createInvite: async () => ({ ok: true, invitationId: "inv_1" }),
    createOrganization: async () => ({ ok: true, workspaceId: "ws-2" }),
    deleteOrganization: async () => ({ ok: true }),
    getSession: async () => ({ user: { email: "owner@acme.test", id: "user-1" } }),
    getSessionEmail: async () => "owner@acme.test",
    leaveOrganization: async () => ({ ok: true }),
    listMembers: async () => ({ ok: true, payload: MEMBERS_PAYLOAD }),
    removeMember: async () => ({ ok: true }),
    renameOrganization: async () => ({ ok: true }),
    resendInvite: async () => ({ ok: true }),
    resolveWorkspace: async () => MANAGER_CONTEXT,
    revokeInvite: async () => ({ ok: true }),
    updateRole: async () => ({ ok: true }),
    ...overrides,
  };
  return { bff: createMobileOrganizationBff(deps), deps };
}

describe("input normalizers", () => {
  it("normalizes organization names and rejects empty/oversized values", () => {
    expect(normalizeMobileOrganizationName("  Acme   Corp ")).toBe("Acme Corp");
    expect(normalizeMobileOrganizationName("   ")).toBeNull();
    expect(normalizeMobileOrganizationName("x".repeat(121))).toBeNull();
    expect(normalizeMobileOrganizationName(42)).toBeNull();
  });

  it("accepts only invitable roles for invites", () => {
    expect(normalizeMobileInviteRole("ADMIN")).toBe("admin");
    expect(normalizeMobileInviteRole("viewer")).toBeNull();
    expect(normalizeMobileInviteRole("owner")).toBeNull();
    expect(normalizeMobileAssignableRole("Owner")).toBe("owner");
    expect(normalizeMobileAssignableRole("nope")).toBeNull();
  });
});

describe("mobile organization BFF listMembers", () => {
  it("returns 401 without a session", async () => {
    const { bff } = makeBff({ getSession: async () => null });
    const response = await bff.listMembers(new Headers());
    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: { code: "unauthorized", message: expect.any(String) },
    });
  });

  it("returns 404 when no workspace resolves", async () => {
    const { bff } = makeBff({ resolveWorkspace: async () => null });
    const response = await bff.listMembers(new Headers());
    expect(response.status).toBe(404);
  });

  it("returns members payload", async () => {
    const { bff } = makeBff();
    const response = await bff.listMembers(new Headers());
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: MEMBERS_PAYLOAD });
  });
});

describe("mobile organization BFF invite", () => {
  it("rejects non-managers with 403", async () => {
    const { bff } = makeBff({
      resolveWorkspace: async () => ({ ...MANAGER_CONTEXT, role: "member" }),
    });
    const response = await bff.invite(new Headers(), { email: "a@b.test" });
    expect(response.status).toBe(403);
  });

  it("rejects invalid email or role with 422", async () => {
    const { bff } = makeBff();
    const bad = await bff.invite(new Headers(), { email: "nope" });
    expect(bad.status).toBe(422);
    const badRole = await bff.invite(new Headers(), { email: "a@b.test", role: "owner" });
    expect(badRole.status).toBe(422);
  });

  it("maps already-member and seat-limit reasons", async () => {
    const { bff: dup } = makeBff({
      createInvite: async () => ({ ok: false, reason: "already-member" }),
    });
    expect((await dup.invite(new Headers(), { email: "a@b.test" })).status).toBe(409);

    const { bff: seat } = makeBff({
      createInvite: async () => ({ ok: false, reason: "seat-limit-exceeded" }),
    });
    const response = await seat.invite(new Headers(), { email: "a@b.test" });
    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: { code: "seatLimitExceeded", message: expect.any(String) },
    });
  });

  it("defaults role to member and returns 201", async () => {
    let captured: { email: string; role: string } | undefined;
    const { bff } = makeBff({
      createInvite: async (_ctx, input) => {
        captured = input;
        return { ok: true, invitationId: "inv_9" };
      },
    });
    const response = await bff.invite(new Headers(), { email: "New@Acme.test" });
    expect(response.status).toBe(201);
    expect(captured).toEqual({ email: "new@acme.test", role: "member" });
    expect(response.body).toEqual({ data: { invitationId: "inv_9" } });
  });
});

describe("mobile organization BFF invitation mutations", () => {
  it("maps missing invitations to 404", async () => {
    const { bff } = makeBff({
      resendInvite: async () => ({ ok: false, reason: "missing" }),
      revokeInvite: async () => ({ ok: false, reason: "missing" }),
    });
    expect((await bff.resendInvite(new Headers(), "inv_x")).status).toBe(404);
    expect((await bff.revokeInvite(new Headers(), "inv_x")).status).toBe(404);
  });

  it("maps non-pending invitations to 422", async () => {
    const { bff } = makeBff({
      resendInvite: async () => ({ ok: false, reason: "not-pending" }),
      revokeInvite: async () => ({ ok: false, reason: "not-pending" }),
    });
    expect((await bff.resendInvite(new Headers(), "inv_x")).status).toBe(422);
    expect((await bff.revokeInvite(new Headers(), "inv_x")).status).toBe(422);
  });

  it("maps expired resend and legacy acceptance seat-cap failures to 409", async () => {
    const { bff } = makeBff({
      resendInvite: async () => ({ ok: false, reason: "seat-limit-exceeded" }),
      acceptInvite: async () => ({ ok: false, reason: "seat-limit-exceeded" }),
    });
    const resend = await bff.resendInvite(new Headers(), "inv_x");
    const accept = await bff.acceptInvite(new Headers(), { token: "token" });
    expect(resend.status).toBe(409);
    expect(accept.status).toBe(409);
    expect(resend.body).toEqual({
      error: { code: "seatLimitExceeded", message: expect.any(String) },
    });
    expect(accept.body).toEqual({
      error: { code: "seatLimitExceeded", message: expect.any(String) },
    });
  });
});

describe("mobile organization BFF acceptInvite", () => {
  it("requires a session", async () => {
    const { bff } = makeBff({ getSession: async () => null });
    expect((await bff.acceptInvite(new Headers(), { token: "t" })).status).toBe(401);
  });

  it("falls back to getSessionEmail when the session lacks email", async () => {
    let usedEmail = "";
    const { bff } = makeBff({
      getSession: async () => ({ user: { id: "user-2" } }),
      acceptInvite: async (_ctx, input) => {
        usedEmail = input.sessionEmail;
        return { ok: true, workspaceId: "ws-9" };
      },
    });
    const response = await bff.acceptInvite(new Headers(), { token: "t" });
    expect(response.status).toBe(200);
    expect(usedEmail).toBe("owner@acme.test");
  });

  it("maps decision reasons", async () => {
    const cases: Array<
      [
        Parameters<MobileOrganizationDependencies["acceptInvite"]>[1] extends never
          ? never
          : "email-mismatch" | "expired" | "missing" | "not-pending" | "seat-limit-exceeded",
        number,
      ]
    > = [
      ["missing", 404],
      ["not-pending", 422],
      ["expired", 422],
      ["email-mismatch", 403],
      ["seat-limit-exceeded", 409],
    ];
    for (const [reason, status] of cases) {
      const { bff } = makeBff({ acceptInvite: async () => ({ ok: false, reason }) });
      expect((await bff.acceptInvite(new Headers(), { token: "t" })).status).toBe(status);
    }
  });
});

describe("mobile organization BFF member mutations", () => {
  it("maps role-update reasons", async () => {
    const { bff } = makeBff({
      updateRole: async () => ({ ok: false, reason: "sole-owner" }),
    });
    const response = await bff.updateRole(new Headers(), "user-2", { role: "member" });
    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: { code: "soleOwner", message: expect.any(String) },
    });
  });

  it("rejects invalid role payloads", async () => {
    const { bff } = makeBff();
    expect((await bff.updateRole(new Headers(), "user-2", { role: "superadmin" })).status).toBe(
      422,
    );
  });

  it("maps self-removal to a leave hint", async () => {
    const { bff } = makeBff({
      removeMember: async () => ({ ok: false, reason: "self" }),
    });
    const response = await bff.removeMember(new Headers(), "user-1");
    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: { code: "selfRemoval", message: expect.any(String) },
    });
  });

  it("maps leave reasons", async () => {
    const { bff } = makeBff({
      leaveOrganization: async () => ({ ok: false, reason: "sole-owner" }),
    });
    const response = await bff.leave(new Headers());
    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: { code: "soleOwner", message: expect.any(String) },
    });
  });

  it("rejects leaving when workspace membership was revoked before the locked mutation", async () => {
    const { bff } = makeBff({
      leaveOrganization: async () => ({ ok: false, reason: "forbidden" }),
    });
    const response = await bff.leave(new Headers());
    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: { code: "forbidden", message: expect.any(String) },
    });
  });
});

describe("mobile organization BFF organization lifecycle", () => {
  it("creates organizations for signed-in users only", async () => {
    const { bff: anon } = makeBff({ getSession: async () => null });
    expect((await anon.createOrganization(new Headers(), { name: "X" })).status).toBe(401);

    const { bff } = makeBff();
    const response = await bff.createOrganization(new Headers(), { name: "  New Org " });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ data: { workspaceId: "ws-2" } });
  });

  it("restricts rename/delete to owners", async () => {
    const { bff } = makeBff({
      resolveWorkspace: async () => ({ ...MANAGER_CONTEXT, role: "admin" }),
    });
    expect((await bff.renameOrganization(new Headers(), { name: "New" })).status).toBe(403);
    expect((await bff.deleteOrganization(new Headers(), { confirm: "Acme Org" })).status).toBe(403);
  });

  it("maps invalid delete confirmation", async () => {
    const { bff } = makeBff({
      deleteOrganization: async () => ({ ok: false, reason: "invalid-confirm" }),
    });
    const response = await bff.deleteOrganization(new Headers(), { confirm: "wrong" });
    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      error: { code: "invalidInput", message: expect.any(String) },
    });
  });
});
