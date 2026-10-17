import type { WorkspaceRole } from "@supastack/db";

import type { OrganizationMemberRow, OrganizationPendingInviteRow } from "./organization-actions";

/**
 * Workspace role literals accepted by the mobile organization endpoints —
 * identical vocabulary to the web members settings (owner/admin/member/guest).
 */
export const MOBILE_ORGANIZATION_ROLES = ["admin", "member", "guest"] as const;
export type MobileInvitableRole = (typeof MOBILE_ORGANIZATION_ROLES)[number];
export const MOBILE_ASSIGNABLE_ROLES = ["owner", "admin", "member", "guest"] as const;
export type MobileAssignableRole = (typeof MOBILE_ASSIGNABLE_ROLES)[number];

export interface MobileOrganizationContext {
  role: WorkspaceRole;
  userId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceType: "organization" | "personal";
}

export interface MobileOrganizationSession {
  user: { id: string; email?: string | null };
}

export interface MobileMembersPayload {
  canLeave: boolean;
  canManage: boolean;
  currentRole: WorkspaceRole;
  currentUserId: string;
  members: OrganizationMemberRow[];
  pendingInvitations: OrganizationPendingInviteRow[];
  seatCount: number;
  seatLimit: number | null;
  workspaceId: string;
  workspaceName: string;
}

export type InviteCreateResult =
  | { ok: true; invitationId: string }
  | {
      ok: false;
      reason: "already-invited" | "already-member" | "not-organization" | "seat-limit-exceeded";
    };

export type InvitationMutationResult =
  { ok: true } | { ok: false; reason: "missing" | "not-pending" | "seat-limit-exceeded" };

export type InviteAcceptResult =
  | { ok: true; workspaceId: string }
  | {
      ok: false;
      reason: "email-mismatch" | "expired" | "missing" | "not-pending" | "seat-limit-exceeded";
    };

export type RoleUpdateResult =
  | { ok: true }
  | {
      ok: false;
      reason: "forbidden" | "not-member" | "not-organization" | "sole-owner" | "unchanged";
    };

export type MemberRemovalResult =
  { ok: true } | { ok: false; reason: "forbidden" | "not-member" | "self" | "sole-owner" };

export type LeaveOrganizationResult =
  { ok: true } | { ok: false; reason: "forbidden" | "personal" | "sole-owner" };

export type CreateOrganizationResult = { ok: true; workspaceId: string };

export type RenameOrganizationResult =
  { ok: true } | { ok: false; reason: "forbidden" | "not-organization" };

export type DeleteOrganizationResult =
  { ok: true } | { ok: false; reason: "forbidden" | "invalid-confirm" | "not-organization" };

export interface MobileOrganizationDependencies {
  acceptInvite(
    context: { userId: string },
    input: { sessionEmail: string; token: string },
  ): Promise<InviteAcceptResult>;
  createInvite(
    context: MobileOrganizationContext,
    input: { email: string; role: MobileInvitableRole },
  ): Promise<InviteCreateResult>;
  createOrganization(userId: string, input: { name: string }): Promise<CreateOrganizationResult>;
  deleteOrganization(
    context: MobileOrganizationContext,
    input: { confirm: string },
  ): Promise<DeleteOrganizationResult>;
  getSession(headers: Headers): Promise<MobileOrganizationSession | null>;
  getSessionEmail(userId: string): Promise<string | null>;
  leaveOrganization(context: MobileOrganizationContext): Promise<LeaveOrganizationResult>;
  listMembers(
    context: MobileOrganizationContext,
  ): Promise<
    { ok: true; payload: MobileMembersPayload } | { ok: false; reason: "not-organization" }
  >;
  removeMember(
    context: MobileOrganizationContext,
    targetUserId: string,
  ): Promise<MemberRemovalResult>;
  renameOrganization(
    context: MobileOrganizationContext,
    input: { name: string },
  ): Promise<RenameOrganizationResult>;
  resendInvite(
    context: MobileOrganizationContext,
    invitationId: string,
  ): Promise<InvitationMutationResult>;
  resolveWorkspace(userId: string): Promise<MobileOrganizationContext | null>;
  revokeInvite(
    context: MobileOrganizationContext,
    invitationId: string,
  ): Promise<InvitationMutationResult>;
  updateRole(
    context: MobileOrganizationContext,
    input: { nextRole: MobileAssignableRole; targetUserId: string },
  ): Promise<RoleUpdateResult>;
}

type BffErrorCode =
  | "alreadyInvited"
  | "alreadyMember"
  | "emailMismatch"
  | "expired"
  | "forbidden"
  | "internalError"
  | "invalidInput"
  | "noWorkspace"
  | "notFound"
  | "notOrganization"
  | "personalWorkspace"
  | "seatLimitExceeded"
  | "selfRemoval"
  | "soleOwner"
  | "unauthorized"
  | "unchanged";

type BffError = {
  body: { error: { code: BffErrorCode; message: string } };
  status: 400 | 401 | 403 | 404 | 409 | 422 | 500;
};

type BffOk<T> = { body: { data: T }; status: 200 | 201 };

export type MobileBffResponse<T> = BffOk<T> | BffError;

const ORGANIZATION_NAME_MAX = 120;
const EMAIL_MAX = 320;

function error(code: BffErrorCode, message: string, status: BffError["status"]): BffError {
  return { body: { error: { code, message } }, status };
}

function internalError(): BffError {
  return error("internalError", "The request could not be completed.", 500);
}

export function normalizeMobileOrganizationName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length === 0 || normalized.length > ORGANIZATION_NAME_MAX) return null;
  return normalized;
}

export function normalizeMobileInviteRole(value: unknown): MobileInvitableRole | null {
  if (typeof value !== "string") return null;
  const role = value.trim().toLowerCase();
  return (MOBILE_ORGANIZATION_ROLES as readonly string[]).includes(role)
    ? (role as MobileInvitableRole)
    : null;
}

export function normalizeMobileAssignableRole(value: unknown): MobileAssignableRole | null {
  if (typeof value !== "string") return null;
  const role = value.trim().toLowerCase();
  return (MOBILE_ASSIGNABLE_ROLES as readonly string[]).includes(role)
    ? (role as MobileAssignableRole)
    : null;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length === 0 || email.length > EMAIL_MAX || !email.includes("@")) return null;
  return email;
}

async function resolveContext(
  deps: MobileOrganizationDependencies,
  headers: Headers,
): Promise<{ session: MobileOrganizationSession; context: MobileOrganizationContext } | BffError> {
  const session = await deps.getSession(headers);
  if (session === null) {
    return error("unauthorized", "Sign in to continue.", 401);
  }
  const context = await deps.resolveWorkspace(session.user.id);
  if (context === null) {
    return error("noWorkspace", "No workspace is available for this account.", 404);
  }
  return { context, session };
}

async function resolveManagerContext(
  deps: MobileOrganizationDependencies,
  headers: Headers,
): Promise<{ session: MobileOrganizationSession; context: MobileOrganizationContext } | BffError> {
  const resolved = await resolveContext(deps, headers);
  if ("body" in resolved) {
    return resolved;
  }
  if (resolved.context.role !== "owner" && resolved.context.role !== "admin") {
    return error("forbidden", "An owner or admin role is required.", 403);
  }
  return resolved;
}

/**
 * Behavior boundary for `/api/mobile/{organization,members,invitations}` —
 * the mobile counterpart of the `organization-actions` server actions.
 * Stateless and dependency-injected so the decision layer is exercised with
 * deterministic data; `mobile-organization.ts` supplies the real wiring.
 */
export function createMobileOrganizationBff(deps: MobileOrganizationDependencies) {
  return {
    async listMembers(headers: Headers): Promise<MobileBffResponse<MobileMembersPayload>> {
      try {
        const resolved = await resolveContext(deps, headers);
        if ("body" in resolved) return resolved;
        const listed = await deps.listMembers(resolved.context);
        if (!listed.ok) {
          return error("notOrganization", "The active workspace is not an organization.", 404);
        }
        return { body: { data: listed.payload }, status: 200 };
      } catch {
        return internalError();
      }
    },

    async invite(
      headers: Headers,
      input: { email?: unknown; role?: unknown },
    ): Promise<MobileBffResponse<{ invitationId: string }>> {
      try {
        const resolved = await resolveManagerContext(deps, headers);
        if ("body" in resolved) return resolved;
        const email = normalizeEmail(input.email);
        const role = input.role === undefined ? "member" : normalizeMobileInviteRole(input.role);
        if (email === null || role === null) {
          return error("invalidInput", "A valid email and role are required.", 422);
        }
        const result = await deps.createInvite(resolved.context, { email, role });
        if (!result.ok) {
          return inviteError(result.reason);
        }
        return { body: { data: { invitationId: result.invitationId } }, status: 201 };
      } catch {
        return internalError();
      }
    },

    async resendInvite(
      headers: Headers,
      invitationId: string,
    ): Promise<MobileBffResponse<{ resent: true }>> {
      try {
        const resolved = await resolveManagerContext(deps, headers);
        if ("body" in resolved) return resolved;
        const result = await deps.resendInvite(resolved.context, invitationId);
        if (!result.ok) {
          return invitationMutationError(result.reason);
        }
        return { body: { data: { resent: true } }, status: 200 };
      } catch {
        return internalError();
      }
    },

    async revokeInvite(
      headers: Headers,
      invitationId: string,
    ): Promise<MobileBffResponse<{ revoked: true }>> {
      try {
        const resolved = await resolveManagerContext(deps, headers);
        if ("body" in resolved) return resolved;
        const result = await deps.revokeInvite(resolved.context, invitationId);
        if (!result.ok) {
          return invitationMutationError(result.reason);
        }
        return { body: { data: { revoked: true } }, status: 200 };
      } catch {
        return internalError();
      }
    },

    async acceptInvite(
      headers: Headers,
      input: { token?: unknown },
    ): Promise<MobileBffResponse<{ workspaceId: string }>> {
      try {
        const session = await deps.getSession(headers);
        if (session === null) {
          return error("unauthorized", "Sign in to accept this invitation.", 401);
        }
        const token = typeof input.token === "string" ? input.token.trim() : "";
        if (token === "") {
          return error("invalidInput", "An invitation token is required.", 422);
        }
        const sessionEmail = session.user.email ?? (await deps.getSessionEmail(session.user.id));
        if (!sessionEmail) {
          return error("unauthorized", "Sign in to accept this invitation.", 401);
        }
        const result = await deps.acceptInvite(
          { userId: session.user.id },
          { sessionEmail, token },
        );
        if (!result.ok) {
          return acceptError(result.reason);
        }
        return { body: { data: { workspaceId: result.workspaceId } }, status: 200 };
      } catch {
        return internalError();
      }
    },

    async updateRole(
      headers: Headers,
      targetUserId: string,
      input: { role?: unknown },
    ): Promise<MobileBffResponse<{ updated: true }>> {
      try {
        const resolved = await resolveManagerContext(deps, headers);
        if ("body" in resolved) return resolved;
        const nextRole = normalizeMobileAssignableRole(input.role);
        if (nextRole === null) {
          return error("invalidInput", "A valid role is required.", 422);
        }
        const result = await deps.updateRole(resolved.context, {
          nextRole,
          targetUserId,
        });
        if (!result.ok) {
          return roleUpdateError(result.reason);
        }
        return { body: { data: { updated: true } }, status: 200 };
      } catch {
        return internalError();
      }
    },

    async removeMember(
      headers: Headers,
      targetUserId: string,
    ): Promise<MobileBffResponse<{ removed: true }>> {
      try {
        const resolved = await resolveManagerContext(deps, headers);
        if ("body" in resolved) return resolved;
        if (targetUserId.trim() === "") {
          return error("invalidInput", "A member id is required.", 422);
        }
        const result = await deps.removeMember(resolved.context, targetUserId);
        if (!result.ok) {
          return removalError(result.reason);
        }
        return { body: { data: { removed: true } }, status: 200 };
      } catch {
        return internalError();
      }
    },

    async leave(headers: Headers): Promise<MobileBffResponse<{ left: true }>> {
      try {
        const resolved = await resolveContext(deps, headers);
        if ("body" in resolved) return resolved;
        const result = await deps.leaveOrganization(resolved.context);
        if (!result.ok) {
          return leaveError(result.reason);
        }
        return { body: { data: { left: true } }, status: 200 };
      } catch {
        return internalError();
      }
    },

    async createOrganization(
      headers: Headers,
      input: { name?: unknown },
    ): Promise<MobileBffResponse<{ workspaceId: string }>> {
      try {
        const session = await deps.getSession(headers);
        if (session === null) {
          return error("unauthorized", "Sign in to continue.", 401);
        }
        const name = normalizeMobileOrganizationName(input.name);
        if (name === null) {
          return error("invalidInput", "An organization name is required.", 422);
        }
        const result = await deps.createOrganization(session.user.id, { name });
        return { body: { data: { workspaceId: result.workspaceId } }, status: 201 };
      } catch {
        return internalError();
      }
    },

    async renameOrganization(
      headers: Headers,
      input: { name?: unknown },
    ): Promise<MobileBffResponse<{ renamed: true }>> {
      try {
        const resolved = await resolveContext(deps, headers);
        if ("body" in resolved) return resolved;
        if (resolved.context.role !== "owner") {
          return error("forbidden", "Only the owner can rename the organization.", 403);
        }
        const name = normalizeMobileOrganizationName(input.name);
        if (name === null) {
          return error("invalidInput", "An organization name is required.", 422);
        }
        const result = await deps.renameOrganization(resolved.context, { name });
        if (!result.ok) {
          return result.reason === "not-organization"
            ? error("notOrganization", "The active workspace is not an organization.", 404)
            : error("forbidden", "Only the owner can rename the organization.", 403);
        }
        return { body: { data: { renamed: true } }, status: 200 };
      } catch {
        return internalError();
      }
    },

    async deleteOrganization(
      headers: Headers,
      input: { confirm?: unknown },
    ): Promise<MobileBffResponse<{ deleted: true }>> {
      try {
        const resolved = await resolveContext(deps, headers);
        if ("body" in resolved) return resolved;
        if (resolved.context.role !== "owner") {
          return error("forbidden", "Only the owner can delete the organization.", 403);
        }
        const confirm = typeof input.confirm === "string" ? input.confirm : "";
        const result = await deps.deleteOrganization(resolved.context, { confirm });
        if (!result.ok) {
          if (result.reason === "invalid-confirm") {
            return error("invalidInput", "Type the organization name to confirm deletion.", 422);
          }
          if (result.reason === "not-organization") {
            return error("notOrganization", "The active workspace is not an organization.", 404);
          }
          return error("forbidden", "Only the owner can delete the organization.", 403);
        }
        return { body: { data: { deleted: true } }, status: 200 };
      } catch {
        return internalError();
      }
    },
  };
}

function inviteError(reason: Extract<InviteCreateResult, { ok: false }>["reason"]): BffError {
  switch (reason) {
    case "already-member":
      return error("alreadyMember", "That person is already a member.", 409);
    case "already-invited":
      return error("alreadyInvited", "A pending invitation already exists.", 409);
    case "not-organization":
      return error("notOrganization", "The active workspace is not an organization.", 404);
    case "seat-limit-exceeded":
      return error("seatLimitExceeded", "The workspace seat limit is reached.", 409);
  }
}

function invitationMutationError(
  reason: Extract<InvitationMutationResult, { ok: false }>["reason"],
): BffError {
  switch (reason) {
    case "missing":
      return error("notFound", "That invitation does not exist.", 404);
    case "not-pending":
      return error("invalidInput", "That invitation is no longer pending.", 422);
    case "seat-limit-exceeded":
      return error("seatLimitExceeded", "The workspace seat limit is reached.", 409);
  }
}

function acceptError(reason: Extract<InviteAcceptResult, { ok: false }>["reason"]): BffError {
  switch (reason) {
    case "missing":
      return error("notFound", "That invitation does not exist.", 404);
    case "not-pending":
      return error("invalidInput", "That invitation is no longer pending.", 422);
    case "expired":
      return error("expired", "That invitation has expired.", 422);
    case "email-mismatch":
      return error("emailMismatch", "This invitation was sent to a different email address.", 403);
    case "seat-limit-exceeded":
      return error("seatLimitExceeded", "The workspace seat limit is reached.", 409);
  }
}

function roleUpdateError(reason: Extract<RoleUpdateResult, { ok: false }>["reason"]): BffError {
  switch (reason) {
    case "forbidden":
      return error("forbidden", "That role change is not allowed.", 403);
    case "not-member":
      return error("notFound", "That user is not a workspace member.", 404);
    case "not-organization":
      return error("notOrganization", "The active workspace is not an organization.", 404);
    case "sole-owner":
      return error("soleOwner", "Transfer ownership before changing the last owner.", 409);
    case "unchanged":
      return error("unchanged", "The member already holds that role.", 409);
  }
}

function removalError(reason: Extract<MemberRemovalResult, { ok: false }>["reason"]): BffError {
  switch (reason) {
    case "forbidden":
      return error("forbidden", "That member cannot be removed by your role.", 403);
    case "not-member":
      return error("notFound", "That user is not a workspace member.", 404);
    case "self":
      return error("selfRemoval", "Use leave organization to remove yourself.", 409);
    case "sole-owner":
      return error("soleOwner", "Transfer ownership before removing the last owner.", 409);
  }
}

function leaveError(reason: Extract<LeaveOrganizationResult, { ok: false }>["reason"]): BffError {
  if (reason === "personal") {
    return error("personalWorkspace", "A personal workspace cannot be left.", 409);
  }
  if (reason === "sole-owner") {
    return error("soleOwner", "Transfer ownership before leaving as the last owner.", 409);
  }
  return error("forbidden", "Workspace access is required.", 403);
}
