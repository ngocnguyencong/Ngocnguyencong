export type WorkspaceIdKind = "invitation" | "membership" | "workspace";

export type WorkspaceRole = "owner" | "admin" | "member" | "guest";

export type WorkspaceType = "organization" | "personal";

export type WorkspaceInvitationStatus = "accepted" | "pending" | "revoked";

export interface PersonalWorkspaceInput {
  createId: (kind: WorkspaceIdKind) => string;
  now: () => Date;
  userId: string;
  userName?: string | null | undefined;
}

export interface OrganizationWorkspaceInput {
  createId: (kind: WorkspaceIdKind) => string;
  name: string;
  now: () => Date;
  userId: string;
}

export interface WorkspaceInvitationInput {
  createId: (kind: WorkspaceIdKind) => string;
  email: string;
  expiresAt: Date;
  invitedByUserId: string;
  now: () => Date;
  role: Exclude<WorkspaceRole, "owner">;
  token: string;
  workspaceId: string;
}

export interface ResolveActiveWorkspaceInput {
  activeWorkspaceId: string | null | undefined;
  membershipWorkspaceIds: readonly string[];
  personalWorkspaceId: string;
}

const roleRank: Record<WorkspaceRole, number> = {
  owner: 3,
  admin: 2,
  member: 1,
  guest: 0,
};

export function normalizeWorkspaceRole(value: unknown): WorkspaceRole {
  if (typeof value !== "string") {
    return "member";
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "owner") return "owner";
  if (normalized === "admin") return "admin";
  if (normalized === "guest" || normalized === "viewer") return "guest";
  return "member";
}

export function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return (
    typeof value === "string" &&
    (value === "owner" ||
      value === "admin" ||
      value === "member" ||
      value === "guest" ||
      value === "viewer")
  );
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function createPersonalWorkspaceRecords(input: PersonalWorkspaceInput) {
  const now = input.now();
  const workspaceId = input.createId("workspace");
  const membershipId = input.createId("membership");
  const normalizedName = input.userName?.trim();
  const idSuffix = workspaceId.split("_").at(-1)?.toLowerCase() ?? workspaceId.toLowerCase();
  const workspaceName = normalizedName ? `${normalizedName}'s workspace` : "My workspace";
  const baseSlug = normalizedName ? slugify(`${normalizedName} workspace`) : "workspace";

  return {
    workspace: {
      id: workspaceId,
      name: workspaceName,
      slug: `${baseSlug}-${idSuffix}`,
      type: "personal" as const satisfies WorkspaceType,
      createdAt: now,
      updatedAt: now,
    },
    membership: {
      id: membershipId,
      workspaceId,
      userId: input.userId,
      role: "owner" as const satisfies WorkspaceRole,
      createdAt: now,
      updatedAt: now,
    },
  };
}

export function createOrganizationWorkspaceRecords(input: OrganizationWorkspaceInput) {
  const now = input.now();
  const workspaceId = input.createId("workspace");
  const membershipId = input.createId("membership");
  const name = input.name.trim();
  if (!name) {
    throw new Error("Organization name is required.");
  }

  const idSuffix = workspaceId.split("_").at(-1)?.toLowerCase() ?? workspaceId.toLowerCase();
  const baseSlug = slugify(name) || "organization";

  return {
    workspace: {
      id: workspaceId,
      name,
      slug: `${baseSlug}-${idSuffix}`,
      type: "organization" as const satisfies WorkspaceType,
      createdAt: now,
      updatedAt: now,
    },
    membership: {
      id: membershipId,
      workspaceId,
      userId: input.userId,
      role: "owner" as const satisfies WorkspaceRole,
      createdAt: now,
      updatedAt: now,
    },
  };
}

export function createWorkspaceInvitationRecord(input: WorkspaceInvitationInput) {
  const now = input.now();
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Invitation email is required.");
  }

  return {
    id: input.createId("invitation"),
    workspaceId: input.workspaceId,
    email,
    role: input.role,
    token: input.token,
    status: "pending" as const satisfies WorkspaceInvitationStatus,
    invitedByUserId: input.invitedByUserId,
    expiresAt: input.expiresAt,
    createdAt: now,
    updatedAt: now,
  };
}

export function workspaceRoleAtLeast(actual: WorkspaceRole, required: WorkspaceRole): boolean {
  return roleRank[actual] >= roleRank[required];
}

export function canManageWorkspaceMembers(role: WorkspaceRole): boolean {
  return workspaceRoleAtLeast(role, "admin");
}

export function canWriteWorkspace(role: WorkspaceRole): boolean {
  return workspaceRoleAtLeast(role, "member");
}

export function isWorkspaceReadOnly(role: WorkspaceRole): boolean {
  return role === "guest";
}

export function canInviteWorkspaceMembers(role: WorkspaceRole): boolean {
  return canManageWorkspaceMembers(role);
}

export function canEditWorkspaceSettings(role: WorkspaceRole): boolean {
  return role === "owner";
}

export function canDeleteWorkspace(role: WorkspaceRole): boolean {
  return role === "owner";
}

export type LeaveOrganizationDecision =
  Readonly<{ ok: true }> | Readonly<{ ok: false; reason: "personal" | "sole-owner" }>;

export function evaluateLeaveOrganization(input: {
  actorRole: WorkspaceRole;
  ownerCount: number;
  workspaceType: WorkspaceType;
}): LeaveOrganizationDecision {
  if (input.workspaceType !== "organization") {
    return { ok: false, reason: "personal" };
  }
  if (input.actorRole === "owner" && input.ownerCount <= 1) {
    return { ok: false, reason: "sole-owner" };
  }
  return { ok: true };
}

export type MemberRoleUpdateDecision =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; reason: "forbidden" | "sole-owner" | "unchanged" }>;

export function evaluateMemberRoleUpdate(input: {
  actorRole: WorkspaceRole;
  nextRole: WorkspaceRole;
  ownerCount: number;
  targetIsSelf: boolean;
  targetRole: WorkspaceRole;
}): MemberRoleUpdateDecision {
  if (input.nextRole === "owner" && input.actorRole !== "owner") {
    return { ok: false, reason: "forbidden" };
  }
  if (!canManageWorkspaceMembers(input.actorRole)) {
    return { ok: false, reason: "forbidden" };
  }
  if (input.actorRole === "admin" && input.targetRole === "owner") {
    return { ok: false, reason: "forbidden" };
  }
  if (input.nextRole === input.targetRole) {
    return { ok: false, reason: "unchanged" };
  }
  if (input.targetRole === "owner" && input.nextRole !== "owner" && input.ownerCount <= 1) {
    return { ok: false, reason: "sole-owner" };
  }
  return { ok: true };
}

export type MemberRemovalDecision =
  Readonly<{ ok: true }> | Readonly<{ ok: false; reason: "forbidden" | "self" | "sole-owner" }>;

/**
 * Owners and admins can remove lower-ranked members. Self-removal always goes
 * through the leave flow so sole-owner protection stays in one place.
 */
export function evaluateMemberRemoval(input: {
  actorRole: WorkspaceRole;
  ownerCount: number;
  targetIsSelf: boolean;
  targetRole: WorkspaceRole;
}): MemberRemovalDecision {
  if (input.targetIsSelf) {
    return { ok: false, reason: "self" };
  }
  if (!canManageWorkspaceMembers(input.actorRole)) {
    return { ok: false, reason: "forbidden" };
  }
  if (input.targetRole === "owner") {
    if (input.actorRole !== "owner") {
      return { ok: false, reason: "forbidden" };
    }
    if (input.ownerCount <= 1) {
      return { ok: false, reason: "sole-owner" };
    }
    return { ok: true };
  }
  if (roleRank[input.actorRole] <= roleRank[input.targetRole]) {
    return { ok: false, reason: "forbidden" };
  }
  return { ok: true };
}

export type InviteRevocationDecision =
  Readonly<{ ok: true }> | Readonly<{ ok: false; reason: "not-pending" }>;

export function evaluateInviteRevocation(input: { status: string }): InviteRevocationDecision {
  if (input.status !== "pending") {
    return { ok: false, reason: "not-pending" };
  }
  return { ok: true };
}

export type InviteResendDecision =
  Readonly<{ ok: true; rotateToken: boolean }> | Readonly<{ ok: false; reason: "not-pending" }>;

/** Expired pending invites need a fresh token and expiry before resending. */
export function evaluateInviteResend(input: {
  expiresAt: Date;
  now: Date;
  status: string;
}): InviteResendDecision {
  if (input.status !== "pending") {
    return { ok: false, reason: "not-pending" };
  }
  return { ok: true, rotateToken: input.expiresAt.getTime() <= input.now.getTime() };
}

export function resolveActiveWorkspaceId(input: ResolveActiveWorkspaceInput): string {
  if (input.activeWorkspaceId && input.membershipWorkspaceIds.includes(input.activeWorkspaceId)) {
    return input.activeWorkspaceId;
  }

  if (input.membershipWorkspaceIds.includes(input.personalWorkspaceId)) {
    return input.personalWorkspaceId;
  }

  return input.membershipWorkspaceIds[0] ?? input.personalWorkspaceId;
}
