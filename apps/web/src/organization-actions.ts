"use server";

import { randomBytes, randomUUID } from "node:crypto";

import { parseServerConfig } from "@supastack/config";
import {
  AUDIT_ACTIONS,
  billingSubscription,
  canManageWorkspaceMembers,
  createOrganizationWorkspaceRecords,
  createWorkspaceInvitationRecord,
  evaluateInviteResend,
  evaluateInviteRevocation,
  evaluateLeaveOrganization,
  evaluateMemberRemoval,
  evaluateMemberRoleUpdate,
  normalizeWorkspaceRole,
  storedObject,
  user,
  userWorkspacePreference,
  workspace,
  workspaceInvitation,
  workspaceMembership,
  type WorkspaceRole,
} from "@supastack/db";
import { resolveLocale } from "@supastack/i18n";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { recordAuditEvent } from "./audit-runtime";
import { database, getAuthSession } from "./auth-runtime";
import { tryEmitProductNotification } from "./notification-runtime";
import { ACTIVE_WORKSPACE_COOKIE } from "./organization-constants";
import { normalizeOrganizationName } from "./organization-onboarding";
import { createServerTransactionalEmailSender } from "./server-provider-composition";
import { createServerObjectStorage } from "./storage-runtime";
import { checkStorageImageUploadAdmission } from "./storage-upload-admission";
import { replaceStoredWorkspaceImage } from "./storage-image-runtime";
import { tryEmitWorkspaceEvent } from "./webhook-delivery";
import {
  canAcceptWorkspaceSeatReservation,
  buildWorkspaceInviteEmail,
  evaluateInviteAcceptance,
  evaluateWorkspaceSeatLimit,
  workspaceSeatLimitForPriceReference,
} from "./workspace-invite";
import { withWorkspaceSeatTransaction } from "./workspace-seat-transaction";

const serverConfig = parseServerConfig();
const inviteMail = createServerTransactionalEmailSender(serverConfig.providers.email);

function createId(kind: "invitation" | "membership" | "workspace"): string {
  return `${kind}_${randomUUID()}`;
}

/** FormData values can be File objects; only real strings are accepted. */
function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Cookie → stored-preference active-workspace lookup for a caller that has
 * already resolved the session itself — the request cookie and preference
 * row belong to the current session user, so no second `getAuthSession`
 * runs here. Authorization (membership) stays the caller's job.
 */
export async function resolveActiveWorkspaceIdForSessionUser(
  userId: string,
): Promise<string | undefined> {
  const jar = await cookies();
  let workspaceId = jar.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  if (!workspaceId) {
    const preference = await database.query.userWorkspacePreference.findFirst({
      columns: { activeWorkspaceId: true },
      where: (fields, { eq: equals }) => equals(fields.userId, userId),
    });
    workspaceId = preference?.activeWorkspaceId;
  }
  return workspaceId;
}

export async function resolveActiveWorkspaceIdForUser(userId: string): Promise<string | undefined> {
  const session = await getAuthSession(await headers());
  if (session === null || session.user.id !== userId) {
    return undefined;
  }
  return resolveActiveWorkspaceIdForSessionUser(userId);
}

export async function listMembershipsForCurrentUser() {
  const session = await getAuthSession(await headers());
  if (session === null) {
    return { ok: false as const, error: "Sign in required.", memberships: [] };
  }

  const rows = await database
    .select({
      role: workspaceMembership.role,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      workspaceType: workspace.type,
    })
    .from(workspaceMembership)
    .innerJoin(workspace, eq(workspace.id, workspaceMembership.workspaceId))
    .where(eq(workspaceMembership.userId, session.user.id));

  const logoMap = new Map<string, string>();
  if (rows.length > 0) {
    const storage = createServerObjectStorage();
    const logoRows = await database
      .select({
        workspaceId: storedObject.workspaceId,
        objectKey: storedObject.objectKey,
      })
      .from(storedObject)
      .where(
        and(
          inArray(
            storedObject.workspaceId,
            rows.map((r) => r.workspaceId),
          ),
          eq(storedObject.purpose, "logo"),
        ),
      )
      .orderBy(desc(storedObject.createdAt));
    for (const row of logoRows) {
      if (!logoMap.has(row.workspaceId)) {
        logoMap.set(
          row.workspaceId,
          storage.getPublicUrl({ workspaceId: row.workspaceId, key: row.objectKey }),
        );
      }
    }
  }

  return {
    ok: true as const,
    memberships: rows.map(
      (
        row,
      ): {
        role: WorkspaceRole;
        workspaceId: string;
        workspaceLogo: string | null;
        workspaceName: string;
        workspaceType: "organization" | "personal";
      } => ({
        role: normalizeWorkspaceRole(row.role),
        workspaceId: row.workspaceId,
        workspaceName: row.workspaceName,
        workspaceType: row.workspaceType === "organization" ? "organization" : "personal",
        workspaceLogo: logoMap.get(row.workspaceId) ?? null,
      }),
    ),
  };
}

export async function createOrganizationAction(formData: FormData): Promise<void> {
  const session = await getAuthSession(await headers());
  if (session === null) {
    redirect("/auth");
  }

  const name = normalizeOrganizationName(formString(formData, "name"));
  if (name === null) {
    redirect("/new-organization?status=invalid-name");
  }

  const records = createOrganizationWorkspaceRecords({
    createId,
    name,
    now: () => new Date(),
    userId: session.user.id,
  });

  await database.insert(workspace).values(records.workspace);
  await database.insert(workspaceMembership).values(records.membership);

  await recordAuditEvent({
    action: AUDIT_ACTIONS.organizationCreated,
    actorUserId: session.user.id,
    metadata: { name: records.workspace.name },
    targetId: records.workspace.id,
    targetType: "workspace",
    workspaceId: records.workspace.id,
  });

  const jar = await cookies();
  jar.set({
    httpOnly: true,
    name: ACTIVE_WORKSPACE_COOKIE,
    path: "/",
    sameSite: "lax",
    value: records.workspace.id,
  });

  redirect("/select-organization?status=created");
}

export async function setActiveWorkspaceAction(formData: FormData): Promise<void> {
  const session = await getAuthSession(await headers());
  if (session === null) {
    redirect("/auth");
  }

  const workspaceId = formString(formData, "workspaceId");
  const [membership] = await database
    .select({ workspaceId: workspaceMembership.workspaceId })
    .from(workspaceMembership)
    .where(
      and(
        eq(workspaceMembership.userId, session.user.id),
        eq(workspaceMembership.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (membership === undefined) {
    redirect("/select-organization?status=forbidden");
  }

  const jar = await cookies();
  jar.set({
    httpOnly: true,
    name: ACTIVE_WORKSPACE_COOKIE,
    path: "/",
    sameSite: "lax",
    value: workspaceId,
  });

  await database
    .insert(userWorkspacePreference)
    .values({
      userId: session.user.id,
      activeWorkspaceId: workspaceId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userWorkspacePreference.userId,
      set: { activeWorkspaceId: workspaceId, updatedAt: new Date() },
    });

  redirect("/choose-plan?status=active");
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function uploadOrganizationLogoAction(formData: FormData): Promise<void> {
  const session = await getAuthSession(await headers());
  if (session === null) {
    redirect("/auth");
  }

  const workspaceId = formString(formData, "workspaceId");
  if (!workspaceId) {
    redirect("/organization/settings?status=invalid");
  }

  const [membership] = await database
    .select({ role: workspaceMembership.role })
    .from(workspaceMembership)
    .where(
      and(
        eq(workspaceMembership.userId, session.user.id),
        eq(workspaceMembership.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (
    membership === undefined ||
    !canManageWorkspaceMembers(normalizeWorkspaceRole(membership.role))
  ) {
    redirect("/organization/settings?status=forbidden");
  }

  const admission = await checkStorageImageUploadAdmission({
    workspaceId,
    userId: session.user.id,
  });
  if (!admission.allowed) {
    redirect("/organization/settings?status=upload-rate-limited");
  }

  const file = formData.get("logo") ?? formData.get("file");
  if (!(file instanceof File) || file.size <= 0 || file.size > MAX_LOGO_BYTES) {
    redirect("/organization/settings?status=invalid-logo");
  }
  if (!ALLOWED_LOGO_TYPES.has(file.type)) {
    redirect("/organization/settings?status=invalid-logo-type");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const uploaded = await replaceStoredWorkspaceImage({
    workspaceId,
    userId: session.user.id,
    purpose: "logo",
    contentType: file.type,
    body: bytes,
  });

  await recordAuditEvent({
    action: AUDIT_ACTIONS.organizationLogoUploaded,
    actorUserId: session.user.id,
    metadata: { objectKey: uploaded.key },
    targetId: workspaceId,
    targetType: "workspace",
    workspaceId,
  });

  redirect("/organization/settings?status=logo-updated");
}

export async function getWorkspaceSeatLimit(workspaceId: string): Promise<number | null> {
  const session = await getAuthSession(await headers());
  if (session === null) {
    throw new Error("Workspace access required.");
  }
  const [membership] = await database
    .select({ workspaceId: workspaceMembership.workspaceId })
    .from(workspaceMembership)
    .where(
      and(
        eq(workspaceMembership.userId, session.user.id),
        eq(workspaceMembership.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (membership === undefined) {
    throw new Error("Workspace access required.");
  }
  const activeSubs = await database
    .select({ priceReference: billingSubscription.priceReference })
    .from(billingSubscription)
    .where(
      and(
        eq(billingSubscription.workspaceId, workspaceId),
        eq(billingSubscription.status, "active"),
      ),
    )
    .limit(1);

  return workspaceSeatLimitForPriceReference(activeSubs[0]?.priceReference);
}

export async function createWorkspaceInviteAction(formData: FormData): Promise<void> {
  const session = await getAuthSession(await headers());
  if (session === null) {
    redirect("/auth");
  }

  const email = formString(formData, "email").trim().toLowerCase();
  const jar = await cookies();
  let workspaceId = jar.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  if (!workspaceId) {
    const preference = await database.query.userWorkspacePreference.findFirst({
      columns: { activeWorkspaceId: true },
      where: (fields, { eq: equals }) => equals(fields.userId, session.user.id),
    });
    workspaceId = preference?.activeWorkspaceId;
  }
  if (!email.includes("@") || !workspaceId) {
    redirect("/settings/members?status=invalid");
  }

  const [membership] = await database
    .select({ role: workspaceMembership.role })
    .from(workspaceMembership)
    .where(
      and(
        eq(workspaceMembership.userId, session.user.id),
        eq(workspaceMembership.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (
    membership === undefined ||
    !canManageWorkspaceMembers(normalizeWorkspaceRole(membership.role))
  ) {
    redirect("/settings/members?status=forbidden");
  }

  const [org] = await database
    .select({ name: workspace.name, type: workspace.type })
    .from(workspace)
    .where(eq(workspace.id, workspaceId))
    .limit(1);
  if (org === undefined || org.type !== "organization") {
    redirect("/settings/members?status=invalid");
  }

  const roleRaw = (formString(formData, "role") || "member").trim().toLowerCase();
  const role: Exclude<WorkspaceRole, "owner"> =
    roleRaw === "admin"
      ? "admin"
      : roleRaw === "guest" || roleRaw === "viewer"
        ? "guest"
        : "member";
  const reservation = await withWorkspaceSeatTransaction(
    database,
    workspaceId,
    async (transaction) => {
      const [existingMember] = await transaction
        .select({ id: workspaceMembership.id })
        .from(workspaceMembership)
        .innerJoin(user, eq(user.id, workspaceMembership.userId))
        .where(and(eq(workspaceMembership.workspaceId, workspaceId), eq(user.email, email)))
        .limit(1);
      if (existingMember !== undefined) {
        return { ok: false as const, reason: "already-member" as const };
      }

      const [existingInvite] = await transaction
        .select({ id: workspaceInvitation.id })
        .from(workspaceInvitation)
        .where(
          and(
            eq(workspaceInvitation.workspaceId, workspaceId),
            eq(workspaceInvitation.email, email),
            eq(workspaceInvitation.status, "pending"),
            sql`${workspaceInvitation.expiresAt} > now()`,
          ),
        )
        .limit(1);
      if (existingInvite !== undefined) {
        return { ok: false as const, reason: "already-invited" as const };
      }

      const [memberCountRow] = await transaction
        .select({ count: sql<number>`count(*)::int` })
        .from(workspaceMembership)
        .where(eq(workspaceMembership.workspaceId, workspaceId));
      const [pendingInviteRow] = await transaction
        .select({ count: sql<number>`count(*)::int` })
        .from(workspaceInvitation)
        .where(
          and(
            eq(workspaceInvitation.workspaceId, workspaceId),
            eq(workspaceInvitation.status, "pending"),
            sql`${workspaceInvitation.expiresAt} > now()`,
          ),
        );
      const [activeSubscription] = await transaction
        .select({ priceReference: billingSubscription.priceReference })
        .from(billingSubscription)
        .where(
          and(
            eq(billingSubscription.workspaceId, workspaceId),
            eq(billingSubscription.status, "active"),
          ),
        )
        .limit(1);
      const seatDecision = evaluateWorkspaceSeatLimit({
        memberCount: Number(memberCountRow?.count ?? 0),
        pendingInviteCount: Number(pendingInviteRow?.count ?? 0),
        seatLimit: workspaceSeatLimitForPriceReference(activeSubscription?.priceReference),
      });
      if (!seatDecision.allowed) {
        return { ok: false as const, reason: "seat-limit-exceeded" as const };
      }

      const invitation = createWorkspaceInvitationRecord({
        createId,
        email,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        invitedByUserId: session.user.id,
        now: () => new Date(),
        role,
        token: randomBytes(24).toString("base64url"),
        workspaceId,
      });
      await transaction.insert(workspaceInvitation).values(invitation);
      return { ok: true as const, invitation };
    },
  );
  if (!reservation.ok) {
    const status =
      reservation.reason === "seat-limit-exceeded" ? "seat-limit-exceeded" : reservation.reason;
    redirect(`/settings/members?status=${status}`);
  }
  const { invitation } = reservation;

  const inviter = await database.query.user.findFirst({
    columns: { email: true },
    where: (fields, { eq: equals }) => equals(fields.id, session.user.id),
  });
  const acceptUrl = new URL(`/invite/${invitation.token}`, serverConfig.app.webUrl).toString();
  const requestHeaders = await headers();
  const locale = resolveLocale([
    requestHeaders.get("x-supastack-locale"),
    requestHeaders.get("accept-language"),
  ]);
  const message = buildWorkspaceInviteEmail({
    acceptUrl,
    inviterEmail: inviter?.email ?? "a teammate",
    locale,
    workspaceName: org.name,
  });
  await inviteMail.send({
    category: "transactional",
    footer: message.footer,
    lang: message.lang,
    subject: message.subject,
    text: message.text,
    to: email,
    workspaceId,
  });

  await recordAuditEvent({
    action: AUDIT_ACTIONS.inviteCreated,
    actorUserId: session.user.id,
    metadata: { email, role },
    targetId: invitation.id,
    targetType: "workspace_invitation",
    workspaceId,
  });

  redirect("/settings/members?status=invited");
}

export async function acceptWorkspaceInviteAction(formData: FormData): Promise<void> {
  const session = await getAuthSession(await headers());
  if (session === null) {
    redirect("/auth");
  }

  const token = formString(formData, "token");
  const account = await database.query.user.findFirst({
    columns: { email: true },
    where: (fields, { eq: equals }) => equals(fields.id, session.user.id),
  });
  if (account === undefined) {
    redirect(`/invite/${token}?status=unauthorized`);
  }

  const [candidate] = await database
    .select({ workspaceId: workspaceInvitation.workspaceId })
    .from(workspaceInvitation)
    .where(eq(workspaceInvitation.token, token))
    .limit(1);
  if (candidate === undefined) {
    redirect(`/invite/${token}?status=missing`);
  }

  const acceptance = await withWorkspaceSeatTransaction(
    database,
    candidate.workspaceId,
    async (transaction) => {
      const [invitation] = await transaction
        .select()
        .from(workspaceInvitation)
        .where(eq(workspaceInvitation.token, token))
        .limit(1);
      if (invitation === undefined || invitation.workspaceId !== candidate.workspaceId) {
        return { ok: false as const, reason: "missing" as const };
      }

      const now = new Date();
      const inviteDecision = evaluateInviteAcceptance({
        invitation: {
          email: invitation.email,
          expiresAt: invitation.expiresAt,
          role: invitation.role,
          status: invitation.status,
          workspaceId: invitation.workspaceId,
        },
        now,
        sessionEmail: account.email,
      });
      if (!inviteDecision.ok) return inviteDecision;

      const [memberCountRow] = await transaction
        .select({ count: sql<number>`count(*)::int` })
        .from(workspaceMembership)
        .where(eq(workspaceMembership.workspaceId, candidate.workspaceId));
      const [pendingInviteRow] = await transaction
        .select({ count: sql<number>`count(*)::int` })
        .from(workspaceInvitation)
        .where(
          and(
            eq(workspaceInvitation.workspaceId, candidate.workspaceId),
            eq(workspaceInvitation.status, "pending"),
            sql`${workspaceInvitation.expiresAt} > ${now}`,
          ),
        );
      const [activeSubscription] = await transaction
        .select({ priceReference: billingSubscription.priceReference })
        .from(billingSubscription)
        .where(
          and(
            eq(billingSubscription.workspaceId, candidate.workspaceId),
            eq(billingSubscription.status, "active"),
          ),
        )
        .limit(1);
      if (
        !canAcceptWorkspaceSeatReservation({
          memberCount: Number(memberCountRow?.count ?? 0),
          pendingInviteCount: Number(pendingInviteRow?.count ?? 0),
          seatLimit: workspaceSeatLimitForPriceReference(activeSubscription?.priceReference),
        })
      ) {
        return { ok: false as const, reason: "seat-limit-exceeded" as const };
      }

      const normalizedRole = normalizeWorkspaceRole(inviteDecision.role);
      const role: WorkspaceRole = normalizedRole === "owner" ? "member" : normalizedRole;
      await transaction
        .insert(workspaceMembership)
        .values({
          id: createId("membership"),
          workspaceId: inviteDecision.workspaceId,
          userId: session.user.id,
          role,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({
          target: [workspaceMembership.workspaceId, workspaceMembership.userId],
        });

      await transaction
        .update(workspaceInvitation)
        .set({ status: "accepted", updatedAt: now })
        .where(
          and(eq(workspaceInvitation.token, token), eq(workspaceInvitation.status, "pending")),
        );
      return { ok: true as const, invitation, role, workspaceId: inviteDecision.workspaceId };
    },
  );

  if (!acceptance.ok) {
    redirect(`/invite/${token}?status=${acceptance.reason}`);
  }

  const { invitation } = acceptance;
  const role = acceptance.role;
  const workspaceId = acceptance.workspaceId;

  await tryEmitProductNotification(
    {
      type: "invite.accepted",
      workspaceId,
      memberEmail: account.email,
    },
    { excludeUserIds: [session.user.id] },
  );

  await recordAuditEvent({
    action: AUDIT_ACTIONS.inviteAccepted,
    actorUserId: session.user.id,
    metadata: { email: account.email, role },
    targetId: invitation?.id ?? null,
    targetType: "workspace_invitation",
    workspaceId,
  });
  await tryEmitWorkspaceEvent({
    data: { memberEmail: account.email, role },
    eventType: "invite.accepted",
    workspaceId,
  });
  await tryEmitWorkspaceEvent({
    data: { memberEmail: account.email, role },
    eventType: "member.joined",
    workspaceId,
  });

  const jar = await cookies();
  jar.set({
    httpOnly: true,
    name: ACTIVE_WORKSPACE_COOKIE,
    path: "/",
    sameSite: "lax",
    value: workspaceId,
  });

  redirect("/select-organization?status=joined");
}

export async function renameOrganizationAction(formData: FormData): Promise<void> {
  const session = await getAuthSession(await headers());
  if (session === null) {
    redirect("/auth");
  }

  const workspaceId = formString(formData, "workspaceId");
  const name = normalizeOrganizationName(formString(formData, "name"));
  if (name === null) {
    redirect("/organization/settings?status=invalid-name");
  }

  const [membership] = await database
    .select({ role: workspaceMembership.role })
    .from(workspaceMembership)
    .innerJoin(workspace, eq(workspace.id, workspaceMembership.workspaceId))
    .where(
      and(
        eq(workspaceMembership.userId, session.user.id),
        eq(workspaceMembership.workspaceId, workspaceId),
        eq(workspace.type, "organization"),
      ),
    )
    .limit(1);

  if (membership === undefined || membership.role !== "owner") {
    redirect("/organization/settings?status=forbidden");
  }

  await database
    .update(workspace)
    .set({ name, updatedAt: new Date() })
    .where(eq(workspace.id, workspaceId));

  await recordAuditEvent({
    action: AUDIT_ACTIONS.organizationRenamed,
    actorUserId: session.user.id,
    metadata: { name },
    targetId: workspaceId,
    targetType: "workspace",
    workspaceId,
  });

  redirect("/organization/settings?status=renamed");
}

export async function deleteOrganizationAction(formData: FormData): Promise<void> {
  const session = await getAuthSession(await headers());
  if (session === null) {
    redirect("/auth");
  }

  const workspaceId = formString(formData, "workspaceId");
  const confirm = formString(formData, "confirm");
  const [org] = await database
    .select({ name: workspace.name, type: workspace.type })
    .from(workspace)
    .where(eq(workspace.id, workspaceId))
    .limit(1);

  if (org === undefined || org.type !== "organization" || confirm !== org.name) {
    redirect("/organization/settings?status=invalid-delete");
  }

  const [membership] = await database
    .select({ role: workspaceMembership.role })
    .from(workspaceMembership)
    .where(
      and(
        eq(workspaceMembership.userId, session.user.id),
        eq(workspaceMembership.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (membership === undefined || membership.role !== "owner") {
    redirect("/organization/settings?status=forbidden");
  }

  await recordAuditEvent({
    action: AUDIT_ACTIONS.organizationDeleted,
    actorUserId: session.user.id,
    metadata: { name: org.name },
    targetId: workspaceId,
    targetType: "workspace",
    workspaceId,
  });

  await database.delete(workspace).where(eq(workspace.id, workspaceId));
  redirect("/select-organization?status=deleted");
}

export type OrganizationMemberRow = Readonly<{
  email: string;
  name: string;
  role: WorkspaceRole;
  userId: string;
}>;

export async function listActiveOrganizationMembers() {
  const session = await getAuthSession(await headers());
  if (session === null) {
    return {
      ok: false as const,
      error: "unauthorized" as const,
      members: [] as OrganizationMemberRow[],
    };
  }

  const workspaceId = await resolveActiveWorkspaceIdForUser(session.user.id);
  if (!workspaceId) {
    return {
      ok: false as const,
      error: "no-active" as const,
      members: [] as OrganizationMemberRow[],
    };
  }

  const [org] = await database
    .select({
      name: workspace.name,
      role: workspaceMembership.role,
      type: workspace.type,
      workspaceId: workspace.id,
    })
    .from(workspaceMembership)
    .innerJoin(workspace, eq(workspace.id, workspaceMembership.workspaceId))
    .where(
      and(
        eq(workspaceMembership.userId, session.user.id),
        eq(workspaceMembership.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (org === undefined || org.type !== "organization") {
    return {
      ok: false as const,
      error: "not-organization" as const,
      members: [] as OrganizationMemberRow[],
    };
  }

  const rows = await database
    .select({
      email: user.email,
      name: user.name,
      role: workspaceMembership.role,
      userId: workspaceMembership.userId,
    })
    .from(workspaceMembership)
    .innerJoin(user, eq(user.id, workspaceMembership.userId))
    .where(eq(workspaceMembership.workspaceId, workspaceId));

  const members: OrganizationMemberRow[] = rows.map((row) => ({
    email: row.email,
    name: row.name,
    role: normalizeWorkspaceRole(row.role),
    userId: row.userId,
  }));
  const ownerCount = members.filter((member) => member.role === "owner").length;
  const actorRole = normalizeWorkspaceRole(org.role);
  const leave = evaluateLeaveOrganization({
    actorRole,
    ownerCount,
    workspaceType: "organization",
  });

  const seatLimit = await getWorkspaceSeatLimit(workspaceId);
  const pendingRows = await database
    .select({
      email: workspaceInvitation.email,
      expiresAt: workspaceInvitation.expiresAt,
      id: workspaceInvitation.id,
      role: workspaceInvitation.role,
    })
    .from(workspaceInvitation)
    .where(
      and(
        eq(workspaceInvitation.workspaceId, workspaceId),
        eq(workspaceInvitation.status, "pending"),
      ),
    )
    .orderBy(desc(workspaceInvitation.createdAt));

  const now = new Date();
  const pendingInvitations: OrganizationPendingInviteRow[] = pendingRows.map((row) => ({
    email: row.email,
    expired: row.expiresAt.getTime() <= now.getTime(),
    expiresAt: row.expiresAt.toISOString(),
    id: row.id,
    role: row.role,
  }));
  const pendingInviteCount = pendingInvitations.filter((row) => !row.expired).length;

  return {
    ok: true as const,
    canLeave: leave.ok,
    canManage: canManageWorkspaceMembers(actorRole),
    currentRole: actorRole,
    currentUserId: session.user.id,
    members,
    pendingInvitations,
    workspaceId: org.workspaceId,
    workspaceName: org.name,
    seatCount: members.length + pendingInviteCount,
    seatLimit,
  };
}

export type OrganizationPendingInviteRow = Readonly<{
  email: string;
  expired: boolean;
  expiresAt: string;
  id: string;
  role: string;
}>;

async function requireWorkspaceManager(userId: string) {
  const workspaceId = await resolveActiveWorkspaceIdForUser(userId);
  if (!workspaceId) {
    return null;
  }
  const [actor] = await database
    .select({ role: workspaceMembership.role, type: workspace.type })
    .from(workspaceMembership)
    .innerJoin(workspace, eq(workspace.id, workspaceMembership.workspaceId))
    .where(
      and(eq(workspaceMembership.userId, userId), eq(workspaceMembership.workspaceId, workspaceId)),
    )
    .limit(1);
  if (
    actor === undefined ||
    actor.type !== "organization" ||
    !canManageWorkspaceMembers(normalizeWorkspaceRole(actor.role))
  ) {
    return null;
  }
  return { role: normalizeWorkspaceRole(actor.role), workspaceId };
}

export async function revokeWorkspaceInviteAction(formData: FormData): Promise<void> {
  const session = await getAuthSession(await headers());
  if (session === null) {
    redirect("/auth");
  }

  const manager = await requireWorkspaceManager(session.user.id);
  const invitationId = formString(formData, "invitationId");
  if (manager === null || !invitationId) {
    redirect("/settings/members?status=forbidden");
  }

  const revoked = await withWorkspaceSeatTransaction(
    database,
    manager.workspaceId,
    async (transaction) => {
      const [invitation] = await transaction
        .select({ status: workspaceInvitation.status })
        .from(workspaceInvitation)
        .where(
          and(
            eq(workspaceInvitation.id, invitationId),
            eq(workspaceInvitation.workspaceId, manager.workspaceId),
          ),
        )
        .limit(1);
      if (!evaluateInviteRevocation({ status: invitation?.status ?? "missing" }).ok) {
        return false;
      }

      await transaction
        .update(workspaceInvitation)
        .set({ status: "revoked", updatedAt: new Date() })
        .where(
          and(
            eq(workspaceInvitation.id, invitationId),
            eq(workspaceInvitation.workspaceId, manager.workspaceId),
            eq(workspaceInvitation.status, "pending"),
          ),
        );
      return true;
    },
  );
  if (!revoked) {
    redirect("/settings/members?status=not-pending");
  }

  await recordAuditEvent({
    action: AUDIT_ACTIONS.inviteRevoked,
    actorUserId: session.user.id,
    targetId: invitationId,
    targetType: "workspace_invitation",
    workspaceId: manager.workspaceId,
  });

  redirect("/settings/members?status=invite-revoked");
}

export async function resendWorkspaceInviteAction(formData: FormData): Promise<void> {
  const session = await getAuthSession(await headers());
  if (session === null) {
    redirect("/auth");
  }

  const manager = await requireWorkspaceManager(session.user.id);
  const invitationId = formString(formData, "invitationId");
  if (manager === null || !invitationId) {
    redirect("/settings/members?status=forbidden");
  }

  const resend = await withWorkspaceSeatTransaction(
    database,
    manager.workspaceId,
    async (transaction) => {
      const [invitation] = await transaction
        .select({
          email: workspaceInvitation.email,
          expiresAt: workspaceInvitation.expiresAt,
          status: workspaceInvitation.status,
          token: workspaceInvitation.token,
        })
        .from(workspaceInvitation)
        .where(
          and(
            eq(workspaceInvitation.id, invitationId),
            eq(workspaceInvitation.workspaceId, manager.workspaceId),
          ),
        )
        .limit(1);
      if (invitation === undefined) {
        return { ok: false as const, reason: "not-pending" as const };
      }

      const now = new Date();
      const decision = evaluateInviteResend({
        expiresAt: invitation.expiresAt,
        now,
        status: invitation.status,
      });
      if (!decision.ok) {
        return { ok: false as const, reason: "not-pending" as const };
      }

      let token = invitation.token;
      if (decision.rotateToken) {
        const [memberCountRow] = await transaction
          .select({ count: sql<number>`count(*)::int` })
          .from(workspaceMembership)
          .where(eq(workspaceMembership.workspaceId, manager.workspaceId));
        const [pendingInviteRow] = await transaction
          .select({ count: sql<number>`count(*)::int` })
          .from(workspaceInvitation)
          .where(
            and(
              eq(workspaceInvitation.workspaceId, manager.workspaceId),
              eq(workspaceInvitation.status, "pending"),
              sql`${workspaceInvitation.expiresAt} > ${now}`,
            ),
          );
        const [activeSubscription] = await transaction
          .select({ priceReference: billingSubscription.priceReference })
          .from(billingSubscription)
          .where(
            and(
              eq(billingSubscription.workspaceId, manager.workspaceId),
              eq(billingSubscription.status, "active"),
            ),
          )
          .limit(1);
        const seatDecision = evaluateWorkspaceSeatLimit({
          memberCount: Number(memberCountRow?.count ?? 0),
          pendingInviteCount: Number(pendingInviteRow?.count ?? 0),
          seatLimit: workspaceSeatLimitForPriceReference(activeSubscription?.priceReference),
        });
        if (!seatDecision.allowed) {
          return { ok: false as const, reason: "seat-limit-exceeded" as const };
        }

        token = randomBytes(24).toString("base64url");
        await transaction
          .update(workspaceInvitation)
          .set({
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            token,
            updatedAt: now,
          })
          .where(
            and(
              eq(workspaceInvitation.id, invitationId),
              eq(workspaceInvitation.workspaceId, manager.workspaceId),
              eq(workspaceInvitation.status, "pending"),
            ),
          );
      }

      return { ok: true as const, email: invitation.email, token };
    },
  );
  if (!resend.ok) {
    if (resend.reason === "seat-limit-exceeded") {
      redirect("/settings/members?status=seat-limit-exceeded");
    }
    redirect("/settings/members?status=not-pending");
  }
  const { email, token } = resend;

  const [org] = await database
    .select({ name: workspace.name })
    .from(workspace)
    .where(eq(workspace.id, manager.workspaceId))
    .limit(1);
  const inviter = await database.query.user.findFirst({
    columns: { email: true },
    where: (fields, { eq: equals }) => equals(fields.id, session.user.id),
  });
  const acceptUrl = new URL(`/invite/${token}`, serverConfig.app.webUrl).toString();
  const requestHeaders = await headers();
  const locale = resolveLocale([
    requestHeaders.get("x-supastack-locale"),
    requestHeaders.get("accept-language"),
  ]);
  const message = buildWorkspaceInviteEmail({
    acceptUrl,
    inviterEmail: inviter?.email ?? "a teammate",
    locale,
    workspaceName: org?.name ?? "your organization",
  });
  await inviteMail.send({
    category: "transactional",
    footer: message.footer,
    lang: message.lang,
    subject: message.subject,
    text: message.text,
    to: email,
    workspaceId: manager.workspaceId,
  });

  await recordAuditEvent({
    action: AUDIT_ACTIONS.inviteResent,
    actorUserId: session.user.id,
    targetId: invitationId,
    targetType: "workspace_invitation",
    workspaceId: manager.workspaceId,
  });

  redirect("/settings/members?status=invite-resent");
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const session = await getAuthSession(await headers());
  if (session === null) {
    redirect("/auth");
  }

  const manager = await requireWorkspaceManager(session.user.id);
  const targetUserId = formString(formData, "userId");
  if (manager === null || !targetUserId) {
    redirect("/settings/members?status=forbidden");
  }

  const removal = await withWorkspaceSeatTransaction(
    database,
    manager.workspaceId,
    async (transaction) => {
      const [actor] = await transaction
        .select({ role: workspaceMembership.role, type: workspace.type })
        .from(workspaceMembership)
        .innerJoin(workspace, eq(workspace.id, workspaceMembership.workspaceId))
        .where(
          and(
            eq(workspaceMembership.userId, session.user.id),
            eq(workspaceMembership.workspaceId, manager.workspaceId),
          ),
        )
        .limit(1);
      if (actor === undefined || actor.type !== "organization") {
        return { ok: false as const, reason: "forbidden" as const };
      }

      const [target] = await transaction
        .select({ email: user.email, role: workspaceMembership.role })
        .from(workspaceMembership)
        .innerJoin(user, eq(user.id, workspaceMembership.userId))
        .where(
          and(
            eq(workspaceMembership.userId, targetUserId),
            eq(workspaceMembership.workspaceId, manager.workspaceId),
          ),
        )
        .limit(1);
      if (target === undefined) {
        return { ok: false as const, reason: "not-member" as const };
      }

      const [ownerCountRow] = await transaction
        .select({ count: sql<number>`count(*)::int` })
        .from(workspaceMembership)
        .where(
          and(
            eq(workspaceMembership.workspaceId, manager.workspaceId),
            eq(workspaceMembership.role, "owner"),
          ),
        );
      const decision = evaluateMemberRemoval({
        actorRole: normalizeWorkspaceRole(actor.role),
        ownerCount: Number(ownerCountRow?.count ?? 0),
        targetIsSelf: targetUserId === session.user.id,
        targetRole: normalizeWorkspaceRole(target.role),
      });
      if (!decision.ok) return decision;

      await transaction
        .delete(workspaceMembership)
        .where(
          and(
            eq(workspaceMembership.workspaceId, manager.workspaceId),
            eq(workspaceMembership.userId, targetUserId),
          ),
        );
      return { ok: true as const, email: target.email };
    },
  );
  if (!removal.ok) {
    if (removal.reason === "not-member") {
      redirect("/settings/members?status=not-member");
    }
    redirect(
      `/settings/members?status=${removal.reason === "self" ? "use-leave" : removal.reason}`,
    );
  }
  const targetEmail = removal.email;

  await tryEmitProductNotification(
    {
      type: "member.removed",
      workspaceId: manager.workspaceId,
      memberEmail: targetEmail,
    },
    { excludeUserIds: [session.user.id] },
  );

  await recordAuditEvent({
    action: AUDIT_ACTIONS.memberRemoved,
    actorUserId: session.user.id,
    metadata: { email: targetEmail },
    targetId: targetUserId,
    targetType: "user",
    workspaceId: manager.workspaceId,
  });
  await tryEmitWorkspaceEvent({
    data: { memberEmail: targetEmail },
    eventType: "member.removed",
    workspaceId: manager.workspaceId,
  });

  redirect("/settings/members?status=member-removed");
}

export async function updateMemberRoleAction(formData: FormData): Promise<void> {
  const session = await getAuthSession(await headers());
  if (session === null) {
    redirect("/auth");
  }

  const targetUserId = formString(formData, "userId");
  const nextRoleRaw = formString(formData, "role");
  const nextRole: WorkspaceRole = normalizeWorkspaceRole(nextRoleRaw);
  const workspaceId = await resolveActiveWorkspaceIdForUser(session.user.id);
  if (!workspaceId || !targetUserId) {
    redirect("/settings/members?status=invalid");
  }

  const update = await withWorkspaceSeatTransaction(database, workspaceId, async (transaction) => {
    const [actor] = await transaction
      .select({ role: workspaceMembership.role, type: workspace.type })
      .from(workspaceMembership)
      .innerJoin(workspace, eq(workspace.id, workspaceMembership.workspaceId))
      .where(
        and(
          eq(workspaceMembership.userId, session.user.id),
          eq(workspaceMembership.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    const [target] = await transaction
      .select({ email: user.email, role: workspaceMembership.role })
      .from(workspaceMembership)
      .innerJoin(user, eq(user.id, workspaceMembership.userId))
      .where(
        and(
          eq(workspaceMembership.userId, targetUserId),
          eq(workspaceMembership.workspaceId, workspaceId),
        ),
      )
      .limit(1);

    if (actor === undefined || actor.type !== "organization" || target === undefined) {
      return { ok: false as const, reason: "forbidden" as const };
    }

    const [ownerCountRow] = await transaction
      .select({ count: sql<number>`count(*)::int` })
      .from(workspaceMembership)
      .where(
        and(
          eq(workspaceMembership.workspaceId, workspaceId),
          eq(workspaceMembership.role, "owner"),
        ),
      );
    const decision = evaluateMemberRoleUpdate({
      actorRole: normalizeWorkspaceRole(actor.role),
      nextRole,
      ownerCount: Number(ownerCountRow?.count ?? 0),
      targetIsSelf: targetUserId === session.user.id,
      targetRole: normalizeWorkspaceRole(target.role),
    });
    if (!decision.ok) return decision;

    await transaction
      .update(workspaceMembership)
      .set({ role: nextRole, updatedAt: new Date() })
      .where(
        and(
          eq(workspaceMembership.workspaceId, workspaceId),
          eq(workspaceMembership.userId, targetUserId),
        ),
      );
    return { ok: true as const, email: target.email };
  });
  if (!update.ok) {
    redirect(
      `/settings/members?status=${update.reason === "sole-owner" ? "sole-owner" : "forbidden"}`,
    );
  }
  const targetEmail = update.email;

  await tryEmitProductNotification(
    {
      type: "member.role_changed",
      workspaceId,
      memberEmail: targetEmail,
      role: nextRole,
    },
    { excludeUserIds: [session.user.id] },
  );

  await recordAuditEvent({
    action: AUDIT_ACTIONS.memberRoleChanged,
    actorUserId: session.user.id,
    metadata: { email: targetEmail, role: nextRole },
    targetId: targetUserId,
    targetType: "user",
    workspaceId,
  });

  redirect("/settings/members?status=role-updated");
}

export async function leaveOrganizationAction(formData: FormData): Promise<void> {
  const session = await getAuthSession(await headers());
  if (session === null) {
    redirect("/auth");
  }

  const workspaceId =
    formString(formData, "workspaceId") || (await resolveActiveWorkspaceIdForUser(session.user.id));
  if (!workspaceId) {
    redirect("/select-organization?status=forbidden");
  }

  const leave = await withWorkspaceSeatTransaction(database, workspaceId, async (transaction) => {
    const [actor] = await transaction
      .select({ role: workspaceMembership.role, type: workspace.type })
      .from(workspaceMembership)
      .innerJoin(workspace, eq(workspace.id, workspaceMembership.workspaceId))
      .where(
        and(
          eq(workspaceMembership.userId, session.user.id),
          eq(workspaceMembership.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    if (actor === undefined) {
      return { ok: false as const, reason: "forbidden" as const };
    }

    const [ownerCountRow] = await transaction
      .select({ count: sql<number>`count(*)::int` })
      .from(workspaceMembership)
      .where(
        and(
          eq(workspaceMembership.workspaceId, workspaceId),
          eq(workspaceMembership.role, "owner"),
        ),
      );
    const decision = evaluateLeaveOrganization({
      actorRole: normalizeWorkspaceRole(actor.role),
      ownerCount: Number(ownerCountRow?.count ?? 0),
      workspaceType: actor.type === "organization" ? "organization" : "personal",
    });
    if (!decision.ok) return decision;

    const account = await transaction.query.user.findFirst({
      columns: { email: true },
      where: (fields, { eq: equals }) => equals(fields.id, session.user.id),
    });
    await transaction
      .delete(workspaceMembership)
      .where(
        and(
          eq(workspaceMembership.workspaceId, workspaceId),
          eq(workspaceMembership.userId, session.user.id),
        ),
      );
    return { ok: true as const, email: account?.email ?? null };
  });
  if (!leave.ok) {
    redirect(
      `/organization/settings?status=${leave.reason === "sole-owner" ? "sole-owner" : "forbidden"}`,
    );
  }
  const accountEmail = leave.email;

  await tryEmitProductNotification(
    {
      type: "member.left",
      workspaceId,
      memberEmail: accountEmail ?? "unknown",
    },
    { excludeUserIds: [session.user.id] },
  );

  await recordAuditEvent({
    action: AUDIT_ACTIONS.memberLeft,
    actorUserId: session.user.id,
    metadata: { email: accountEmail },
    targetId: session.user.id,
    targetType: "user",
    workspaceId,
  });
  await tryEmitWorkspaceEvent({
    data: { memberEmail: accountEmail ?? "unknown" },
    eventType: "member.removed",
    workspaceId,
  });

  const jar = await cookies();
  jar.delete(ACTIVE_WORKSPACE_COOKIE);
  redirect("/select-organization?status=left");
}
