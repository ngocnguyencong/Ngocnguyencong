import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import { parseServerConfig } from "@supastack/config";
import {
  AUDIT_ACTIONS,
  billingSubscription,
  createOrganizationWorkspaceRecords,
  createWorkspaceInvitationRecord,
  evaluateInviteResend,
  evaluateInviteRevocation,
  evaluateLeaveOrganization,
  evaluateMemberRemoval,
  evaluateMemberRoleUpdate,
  normalizeWorkspaceRole,
  user,
  userWorkspacePreference,
  workspace,
  workspaceInvitation,
  workspaceMembership,
  type WorkspaceRole,
} from "@supastack/db";
import { resolveLocale } from "@supastack/i18n";
import { and, desc, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";

import { recordAuditEvent } from "./audit-runtime";
import { database, getAuthSession } from "./auth-runtime";
import {
  createMobileOrganizationBff,
  type InviteAcceptResult,
  type InviteCreateResult,
  type InvitationMutationResult,
  type LeaveOrganizationResult,
  type MemberRemovalResult,
  type MobileMembersPayload,
  type MobileOrganizationContext,
  type MobileOrganizationDependencies,
  type MobileOrganizationSession,
  type RenameOrganizationResult,
  type RoleUpdateResult,
  type DeleteOrganizationResult,
  type CreateOrganizationResult,
} from "./mobile-organization-bff";
import { resolveMobileWorkspaceContext } from "./mobile-workspace-context";
import { tryEmitProductNotification } from "./notification-runtime";
import {
  getWorkspaceSeatLimit,
  type OrganizationMemberRow,
  type OrganizationPendingInviteRow,
} from "./organization-actions";
import { createServerTransactionalEmailSender } from "./server-provider-composition";
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

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function createId(kind: "invitation" | "membership" | "workspace"): string {
  return `${kind}_${randomUUID()}`;
}

/** Persists the caller's active workspace so cookie-less mobile clients resolve it. */
async function setWorkspacePreference(userId: string, workspaceId: string): Promise<void> {
  const now = new Date();
  await database
    .insert(userWorkspacePreference)
    .values({ userId, activeWorkspaceId: workspaceId, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: userWorkspacePreference.userId,
      set: { activeWorkspaceId: workspaceId, updatedAt: now },
    });
}

async function listMembersImpl(
  context: MobileOrganizationContext,
): Promise<
  { ok: true; payload: MobileMembersPayload } | { ok: false; reason: "not-organization" }
> {
  if (context.workspaceType !== "organization") {
    return { ok: false, reason: "not-organization" };
  }
  const workspaceId = context.workspaceId;

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
  const leave = evaluateLeaveOrganization({
    actorRole: context.role,
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
    ok: true,
    payload: {
      canLeave: leave.ok,
      canManage: context.role === "owner" || context.role === "admin",
      currentRole: context.role,
      currentUserId: context.userId,
      members,
      pendingInvitations,
      seatCount: members.length + pendingInviteCount,
      seatLimit,
      workspaceId,
      workspaceName: context.workspaceName,
    },
  };
}

async function sendInviteEmail(input: {
  email: string;
  inviterUserId: string;
  token: string;
  workspaceId: string;
  workspaceName: string;
}): Promise<void> {
  const inviter = await database.query.user.findFirst({
    columns: { email: true },
    where: (fields, { eq: equals }) => equals(fields.id, input.inviterUserId),
  });
  const acceptUrl = new URL(`/invite/${input.token}`, serverConfig.app.webUrl).toString();
  const requestHeaders = await headers();
  const locale = resolveLocale([
    requestHeaders.get("x-supastack-locale"),
    requestHeaders.get("accept-language"),
  ]);
  const message = buildWorkspaceInviteEmail({
    acceptUrl,
    inviterEmail: inviter?.email ?? "a teammate",
    locale,
    workspaceName: input.workspaceName,
  });
  await inviteMail.send({
    category: "transactional",
    footer: message.footer,
    lang: message.lang,
    subject: message.subject,
    text: message.text,
    to: input.email,
    workspaceId: input.workspaceId,
  });
}

const deps: MobileOrganizationDependencies = {
  async getSession(requestHeaders): Promise<MobileOrganizationSession | null> {
    const session = await getAuthSession(requestHeaders);
    return session === null ? null : { user: { id: session.user.id } };
  },

  resolveWorkspace(userId) {
    return resolveMobileWorkspaceContext(userId);
  },

  listMembers: listMembersImpl,

  async createInvite(context, { email, role }): Promise<InviteCreateResult> {
    if (context.workspaceType !== "organization") {
      return { ok: false, reason: "not-organization" };
    }
    const workspaceId = context.workspaceId;

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
          expiresAt: new Date(Date.now() + INVITE_TTL_MS),
          invitedByUserId: context.userId,
          now: () => new Date(),
          role,
          token: randomBytes(24).toString("base64url"),
          workspaceId,
        });
        await transaction.insert(workspaceInvitation).values(invitation);
        return { ok: true as const, invitation };
      },
    );
    if (!reservation.ok) return reservation;
    const { invitation } = reservation;

    await sendInviteEmail({
      email,
      inviterUserId: context.userId,
      token: invitation.token,
      workspaceId,
      workspaceName: context.workspaceName,
    });

    await recordAuditEvent({
      action: AUDIT_ACTIONS.inviteCreated,
      actorUserId: context.userId,
      metadata: { email, role },
      targetId: invitation.id,
      targetType: "workspace_invitation",
      workspaceId,
    });

    return { ok: true, invitationId: invitation.id };
  },

  async resendInvite(context, invitationId): Promise<InvitationMutationResult> {
    const resend = await withWorkspaceSeatTransaction(
      database,
      context.workspaceId,
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
              eq(workspaceInvitation.workspaceId, context.workspaceId),
            ),
          )
          .limit(1);

        if (invitation === undefined) {
          return { ok: false as const, reason: "missing" as const };
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
            .where(eq(workspaceMembership.workspaceId, context.workspaceId));
          const [pendingInviteRow] = await transaction
            .select({ count: sql<number>`count(*)::int` })
            .from(workspaceInvitation)
            .where(
              and(
                eq(workspaceInvitation.workspaceId, context.workspaceId),
                eq(workspaceInvitation.status, "pending"),
                sql`${workspaceInvitation.expiresAt} > ${now}`,
              ),
            );
          const [activeSubscription] = await transaction
            .select({ priceReference: billingSubscription.priceReference })
            .from(billingSubscription)
            .where(
              and(
                eq(billingSubscription.workspaceId, context.workspaceId),
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
              expiresAt: new Date(Date.now() + INVITE_TTL_MS),
              token,
              updatedAt: now,
            })
            .where(
              and(
                eq(workspaceInvitation.id, invitationId),
                eq(workspaceInvitation.workspaceId, context.workspaceId),
                eq(workspaceInvitation.status, "pending"),
              ),
            );
        }

        return { ok: true as const, email: invitation.email, token };
      },
    );
    if (!resend.ok) return resend;
    const { email, token } = resend;

    await sendInviteEmail({
      email,
      inviterUserId: context.userId,
      token,
      workspaceId: context.workspaceId,
      workspaceName: context.workspaceName,
    });

    await recordAuditEvent({
      action: AUDIT_ACTIONS.inviteResent,
      actorUserId: context.userId,
      targetId: invitationId,
      targetType: "workspace_invitation",
      workspaceId: context.workspaceId,
    });

    return { ok: true };
  },

  async revokeInvite(context, invitationId): Promise<InvitationMutationResult> {
    const revoked = await withWorkspaceSeatTransaction(
      database,
      context.workspaceId,
      async (transaction) => {
        const [invitation] = await transaction
          .select({ status: workspaceInvitation.status })
          .from(workspaceInvitation)
          .where(
            and(
              eq(workspaceInvitation.id, invitationId),
              eq(workspaceInvitation.workspaceId, context.workspaceId),
            ),
          )
          .limit(1);

        if (invitation === undefined) {
          return { ok: false as const, reason: "missing" as const };
        }
        if (!evaluateInviteRevocation({ status: invitation.status }).ok) {
          return { ok: false as const, reason: "not-pending" as const };
        }

        await transaction
          .update(workspaceInvitation)
          .set({ status: "revoked", updatedAt: new Date() })
          .where(
            and(
              eq(workspaceInvitation.id, invitationId),
              eq(workspaceInvitation.workspaceId, context.workspaceId),
              eq(workspaceInvitation.status, "pending"),
            ),
          );
        return { ok: true as const };
      },
    );
    if (!revoked.ok) return revoked;

    await recordAuditEvent({
      action: AUDIT_ACTIONS.inviteRevoked,
      actorUserId: context.userId,
      targetId: invitationId,
      targetType: "workspace_invitation",
      workspaceId: context.workspaceId,
    });

    return { ok: true };
  },

  async acceptInvite({ userId }, { sessionEmail, token }): Promise<InviteAcceptResult> {
    const [candidate] = await database
      .select({ workspaceId: workspaceInvitation.workspaceId })
      .from(workspaceInvitation)
      .where(eq(workspaceInvitation.token, token))
      .limit(1);
    if (candidate === undefined) {
      return { ok: false, reason: "missing" };
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
        const decision = evaluateInviteAcceptance({
          invitation: {
            email: invitation.email,
            expiresAt: invitation.expiresAt,
            role: invitation.role,
            status: invitation.status,
            workspaceId: invitation.workspaceId,
          },
          now,
          sessionEmail,
        });
        if (!decision.ok) return decision;

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

        const normalizedRole = normalizeWorkspaceRole(decision.role);
        const role: WorkspaceRole = normalizedRole === "owner" ? "member" : normalizedRole;
        await transaction
          .insert(workspaceMembership)
          .values({
            id: createId("membership"),
            workspaceId: decision.workspaceId,
            userId,
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
        return {
          ok: true as const,
          invitation,
          role,
          workspaceId: decision.workspaceId,
        };
      },
    );
    if (!acceptance.ok) return acceptance;
    const { invitation, role, workspaceId } = acceptance;

    await tryEmitProductNotification(
      {
        type: "invite.accepted",
        workspaceId,
        memberEmail: sessionEmail,
      },
      { excludeUserIds: [userId] },
    );

    await recordAuditEvent({
      action: AUDIT_ACTIONS.inviteAccepted,
      actorUserId: userId,
      metadata: { email: sessionEmail, role },
      targetId: invitation?.id ?? null,
      targetType: "workspace_invitation",
      workspaceId,
    });
    await tryEmitWorkspaceEvent({
      data: { memberEmail: sessionEmail, role },
      eventType: "invite.accepted",
      workspaceId,
    });
    await tryEmitWorkspaceEvent({
      data: { memberEmail: sessionEmail, role },
      eventType: "member.joined",
      workspaceId,
    });

    await setWorkspacePreference(userId, workspaceId);
    return { ok: true, workspaceId };
  },

  async updateRole(context, { nextRole, targetUserId }): Promise<RoleUpdateResult> {
    if (context.workspaceType !== "organization") {
      return { ok: false, reason: "not-organization" };
    }
    const workspaceId = context.workspaceId;

    const update = await withWorkspaceSeatTransaction(
      database,
      workspaceId,
      async (transaction) => {
        const [actor] = await transaction
          .select({ role: workspaceMembership.role, type: workspace.type })
          .from(workspaceMembership)
          .innerJoin(workspace, eq(workspace.id, workspaceMembership.workspaceId))
          .where(
            and(
              eq(workspaceMembership.userId, context.userId),
              eq(workspaceMembership.workspaceId, workspaceId),
            ),
          )
          .limit(1);
        if (actor === undefined) return { ok: false as const, reason: "forbidden" as const };
        if (actor.type !== "organization") {
          return { ok: false as const, reason: "not-organization" as const };
        }

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
        if (target === undefined) return { ok: false as const, reason: "not-member" as const };

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
          targetIsSelf: targetUserId === context.userId,
          targetRole: normalizeWorkspaceRole(target.role),
        });
        if (!decision.ok) return { ok: false as const, reason: decision.reason };

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
      },
    );
    if (!update.ok) return update;
    const targetEmail = update.email;

    await tryEmitProductNotification(
      {
        type: "member.role_changed",
        workspaceId,
        memberEmail: targetEmail,
        role: nextRole,
      },
      { excludeUserIds: [context.userId] },
    );

    await recordAuditEvent({
      action: AUDIT_ACTIONS.memberRoleChanged,
      actorUserId: context.userId,
      metadata: { email: targetEmail, role: nextRole },
      targetId: targetUserId,
      targetType: "user",
      workspaceId,
    });

    return { ok: true };
  },

  async removeMember(context, targetUserId): Promise<MemberRemovalResult> {
    if (context.workspaceType !== "organization") {
      return { ok: false, reason: "forbidden" };
    }
    const workspaceId = context.workspaceId;

    const removal = await withWorkspaceSeatTransaction(
      database,
      workspaceId,
      async (transaction) => {
        const [actor] = await transaction
          .select({ role: workspaceMembership.role, type: workspace.type })
          .from(workspaceMembership)
          .innerJoin(workspace, eq(workspace.id, workspaceMembership.workspaceId))
          .where(
            and(
              eq(workspaceMembership.userId, context.userId),
              eq(workspaceMembership.workspaceId, workspaceId),
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
              eq(workspaceMembership.workspaceId, workspaceId),
            ),
          )
          .limit(1);
        if (target === undefined) return { ok: false as const, reason: "not-member" as const };

        const [ownerCountRow] = await transaction
          .select({ count: sql<number>`count(*)::int` })
          .from(workspaceMembership)
          .where(
            and(
              eq(workspaceMembership.workspaceId, workspaceId),
              eq(workspaceMembership.role, "owner"),
            ),
          );
        const decision = evaluateMemberRemoval({
          actorRole: normalizeWorkspaceRole(actor.role),
          ownerCount: Number(ownerCountRow?.count ?? 0),
          targetIsSelf: targetUserId === context.userId,
          targetRole: normalizeWorkspaceRole(target.role),
        });
        if (!decision.ok) return { ok: false as const, reason: decision.reason };

        await transaction
          .delete(workspaceMembership)
          .where(
            and(
              eq(workspaceMembership.workspaceId, workspaceId),
              eq(workspaceMembership.userId, targetUserId),
            ),
          );
        return { ok: true as const, email: target.email };
      },
    );
    if (!removal.ok) return removal;
    const targetEmail = removal.email;

    await tryEmitProductNotification(
      { type: "member.removed", workspaceId, memberEmail: targetEmail },
      { excludeUserIds: [context.userId] },
    );

    await recordAuditEvent({
      action: AUDIT_ACTIONS.memberRemoved,
      actorUserId: context.userId,
      metadata: { email: targetEmail },
      targetId: targetUserId,
      targetType: "user",
      workspaceId,
    });
    await tryEmitWorkspaceEvent({
      data: { memberEmail: targetEmail },
      eventType: "member.removed",
      workspaceId,
    });

    return { ok: true };
  },

  async leaveOrganization(context): Promise<LeaveOrganizationResult> {
    const workspaceId = context.workspaceId;
    const leave = await withWorkspaceSeatTransaction(database, workspaceId, async (transaction) => {
      const [actor] = await transaction
        .select({ role: workspaceMembership.role, type: workspace.type })
        .from(workspaceMembership)
        .innerJoin(workspace, eq(workspace.id, workspaceMembership.workspaceId))
        .where(
          and(
            eq(workspaceMembership.userId, context.userId),
            eq(workspaceMembership.workspaceId, workspaceId),
          ),
        )
        .limit(1);
      if (actor === undefined) return { ok: false as const, reason: "forbidden" as const };

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
      if (!decision.ok) return { ok: false as const, reason: decision.reason };

      const account = await transaction.query.user.findFirst({
        columns: { email: true },
        where: (fields, { eq: equals }) => equals(fields.id, context.userId),
      });
      await transaction
        .delete(workspaceMembership)
        .where(
          and(
            eq(workspaceMembership.workspaceId, workspaceId),
            eq(workspaceMembership.userId, context.userId),
          ),
        );
      return { ok: true as const, email: account?.email ?? null };
    });
    if (!leave.ok) return leave;
    const accountEmail = leave.email;

    await tryEmitProductNotification(
      {
        type: "member.left",
        workspaceId,
        memberEmail: accountEmail ?? "unknown",
      },
      { excludeUserIds: [context.userId] },
    );

    await recordAuditEvent({
      action: AUDIT_ACTIONS.memberLeft,
      actorUserId: context.userId,
      metadata: { email: accountEmail },
      targetId: context.userId,
      targetType: "user",
      workspaceId,
    });
    await tryEmitWorkspaceEvent({
      data: { memberEmail: accountEmail ?? "unknown" },
      eventType: "member.removed",
      workspaceId,
    });

    // Fall back to another membership so subsequent mobile calls keep resolving.
    const [nextMembership] = await database
      .select({ workspaceId: workspaceMembership.workspaceId })
      .from(workspaceMembership)
      .where(eq(workspaceMembership.userId, context.userId))
      .limit(1);
    if (nextMembership) {
      await setWorkspacePreference(context.userId, nextMembership.workspaceId);
    } else {
      await database
        .delete(userWorkspacePreference)
        .where(eq(userWorkspacePreference.userId, context.userId));
    }
    return { ok: true };
  },

  async createOrganization(userId, { name }): Promise<CreateOrganizationResult> {
    const records = createOrganizationWorkspaceRecords({
      createId,
      name,
      now: () => new Date(),
      userId,
    });

    await database.insert(workspace).values(records.workspace);
    await database.insert(workspaceMembership).values(records.membership);

    await recordAuditEvent({
      action: AUDIT_ACTIONS.organizationCreated,
      actorUserId: userId,
      metadata: { name: records.workspace.name },
      targetId: records.workspace.id,
      targetType: "workspace",
      workspaceId: records.workspace.id,
    });

    await setWorkspacePreference(userId, records.workspace.id);
    return { ok: true, workspaceId: records.workspace.id };
  },

  async renameOrganization(context, { name }): Promise<RenameOrganizationResult> {
    if (context.workspaceType !== "organization") {
      return { ok: false, reason: "not-organization" };
    }
    if (context.role !== "owner") {
      return { ok: false, reason: "forbidden" };
    }
    await database
      .update(workspace)
      .set({ name, updatedAt: new Date() })
      .where(eq(workspace.id, context.workspaceId));

    await recordAuditEvent({
      action: AUDIT_ACTIONS.organizationRenamed,
      actorUserId: context.userId,
      metadata: { name },
      targetId: context.workspaceId,
      targetType: "workspace",
      workspaceId: context.workspaceId,
    });
    return { ok: true };
  },

  async deleteOrganization(context, { confirm }): Promise<DeleteOrganizationResult> {
    if (context.workspaceType !== "organization") {
      return { ok: false, reason: "not-organization" };
    }
    if (context.role !== "owner") {
      return { ok: false, reason: "forbidden" };
    }
    if (confirm !== context.workspaceName) {
      return { ok: false, reason: "invalid-confirm" };
    }

    await recordAuditEvent({
      action: AUDIT_ACTIONS.organizationDeleted,
      actorUserId: context.userId,
      metadata: { name: context.workspaceName },
      targetId: context.workspaceId,
      targetType: "workspace",
      workspaceId: context.workspaceId,
    });

    await database.delete(workspace).where(eq(workspace.id, context.workspaceId));
    return { ok: true };
  },

  async getSessionEmail(userId): Promise<string | null> {
    const account = await database.query.user.findFirst({
      columns: { email: true },
      where: (fields, { eq: equals }) => equals(fields.id, userId),
    });
    return account?.email ?? null;
  },
};

export const mobileOrganizationBff = createMobileOrganizationBff(deps);
