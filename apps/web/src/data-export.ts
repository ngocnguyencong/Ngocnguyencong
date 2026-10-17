import "server-only";

import {
  account,
  apiKey,
  auditEvent,
  chatMessage,
  chatThread,
  connectedAccount,
  contentEntry,
  earlyAccessCode,
  featureRequest,
  featureRequestVote,
  notification,
  referral,
  notificationPreference,
  session,
  storedObject,
  user,
  userWorkspacePreference,
  waitlistEntry,
  workspace,
  workspaceInvitation,
  workspaceMembership,
} from "@supastack/db";
import { desc, eq, inArray } from "drizzle-orm";

import { database } from "./auth-runtime";
import { maskExternalAccountId } from "./connected-accounts";

/**
 * GDPR-style personal data export. Secrets never leave the server: session
 * tokens, credential hashes, webhook signing secrets, OAuth tokens, and BYOK
 * material are intentionally excluded.
 */
export async function buildUserDataExport(userId: string) {
  const [profile] = await database
    .select({
      createdAt: user.createdAt,
      email: user.email,
      emailVerified: user.emailVerified,
      id: user.id,
      image: user.image,
      name: user.name,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const sessions = await database
    .select({
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      id: session.id,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
    })
    .from(session)
    .where(eq(session.userId, userId))
    .orderBy(desc(session.createdAt));

  const accounts = await database
    .select({
      createdAt: account.createdAt,
      providerId: account.providerId,
      scope: account.scope,
    })
    .from(account)
    .where(eq(account.userId, userId));

  const memberships = await database
    .select({
      role: workspaceMembership.role,
      workspaceId: workspaceMembership.workspaceId,
      workspaceName: workspace.name,
      workspaceType: workspace.type,
      createdAt: workspaceMembership.createdAt,
    })
    .from(workspaceMembership)
    .innerJoin(workspace, eq(workspace.id, workspaceMembership.workspaceId))
    .where(eq(workspaceMembership.userId, userId));

  const invitations = profile
    ? await database
        .select({
          createdAt: workspaceInvitation.createdAt,
          email: workspaceInvitation.email,
          expiresAt: workspaceInvitation.expiresAt,
          status: workspaceInvitation.status,
          workspaceId: workspaceInvitation.workspaceId,
        })
        .from(workspaceInvitation)
        .where(eq(workspaceInvitation.email, profile.email))
    : [];

  // Connected accounts are workspace-owned — include every workspace the
  // user belongs to. The select list is explicit: token_* columns (the
  // encrypted envelope) must never appear in an export. externalAccountId
  // is masked exactly like the settings UI — the export is user-visible
  // and must not reveal full mailbox identities the panel hides.
  const membershipWorkspaceIds = memberships.map((row) => row.workspaceId);
  const connectedAccounts = (
    membershipWorkspaceIds.length === 0
      ? []
      : await database
          .select({
            createdAt: connectedAccount.createdAt,
            externalAccountId: connectedAccount.externalAccountId,
            label: connectedAccount.label,
            provider: connectedAccount.provider,
            scopes: connectedAccount.scopes,
            status: connectedAccount.status,
            workspaceId: connectedAccount.workspaceId,
          })
          .from(connectedAccount)
          .where(inArray(connectedAccount.workspaceId, membershipWorkspaceIds))
          .orderBy(desc(connectedAccount.createdAt))
          .limit(1000)
  ).map((row) => ({
    ...row,
    externalAccountId: maskExternalAccountId(row.externalAccountId),
  }));

  const notifications = await database
    .select({
      body: notification.body,
      createdAt: notification.createdAt,
      href: notification.href,
      readAt: notification.readAt,
      title: notification.title,
      workspaceId: notification.workspaceId,
    })
    .from(notification)
    .where(eq(notification.userId, userId))
    .orderBy(desc(notification.createdAt))
    .limit(1000);

  const preferences = await database
    .select()
    .from(notificationPreference)
    .where(eq(notificationPreference.userId, userId));

  const workspacePreference = await database
    .select()
    .from(userWorkspacePreference)
    .where(eq(userWorkspacePreference.userId, userId))
    .limit(1);

  const apiKeys = await database
    .select({
      createdAt: apiKey.createdAt,
      expiresAt: apiKey.expiresAt,
      id: apiKey.id,
      lastUsedAt: apiKey.lastUsedAt,
      name: apiKey.name,
      prefix: apiKey.prefix,
      revokedAt: apiKey.revokedAt,
      scopes: apiKey.scopes,
      workspaceId: apiKey.workspaceId,
    })
    .from(apiKey)
    .where(eq(apiKey.userId, userId));

  const authoredAuditEvents = await database
    .select({
      action: auditEvent.action,
      createdAt: auditEvent.createdAt,
      id: auditEvent.id,
      targetId: auditEvent.targetId,
      targetType: auditEvent.targetType,
      workspaceId: auditEvent.workspaceId,
    })
    .from(auditEvent)
    .where(eq(auditEvent.actorUserId, userId))
    .orderBy(desc(auditEvent.createdAt))
    .limit(1000);

  const threads = await database
    .select({
      createdAt: chatThread.createdAt,
      id: chatThread.id,
      title: chatThread.title,
      workspaceId: chatThread.workspaceId,
    })
    .from(chatThread)
    .where(eq(chatThread.userId, userId))
    .orderBy(desc(chatThread.updatedAt));

  const threadIds = threads.map((thread) => thread.id);
  const messages =
    threadIds.length === 0
      ? []
      : await database
          .select({
            content: chatMessage.content,
            createdAt: chatMessage.createdAt,
            role: chatMessage.role,
            threadId: chatMessage.threadId,
          })
          .from(chatMessage)
          .where(inArray(chatMessage.threadId, threadIds))
          .orderBy(chatMessage.createdAt);

  const authoredContent = await database
    .select({
      createdAt: contentEntry.createdAt,
      id: contentEntry.id,
      publishedAt: contentEntry.publishedAt,
      slug: contentEntry.slug,
      status: contentEntry.status,
      title: contentEntry.title,
      type: contentEntry.type,
      workspaceId: contentEntry.workspaceId,
    })
    .from(contentEntry)
    .where(eq(contentEntry.createdBy, userId))
    .orderBy(desc(contentEntry.createdAt))
    .limit(1000);

  const uploads = await database
    .select({
      byteSize: storedObject.byteSize,
      contentType: storedObject.contentType,
      createdAt: storedObject.createdAt,
      objectKey: storedObject.objectKey,
      purpose: storedObject.purpose,
      workspaceId: storedObject.workspaceId,
    })
    .from(storedObject)
    .where(eq(storedObject.userId, userId));

  const authoredFeatureRequests = await database
    .select({
      createdAt: featureRequest.createdAt,
      details: featureRequest.details,
      id: featureRequest.id,
      status: featureRequest.status,
      title: featureRequest.title,
      voteCount: featureRequest.voteCount,
      workspaceId: featureRequest.workspaceId,
    })
    .from(featureRequest)
    .where(eq(featureRequest.createdBy, userId))
    .orderBy(desc(featureRequest.createdAt))
    .limit(1000);

  const featureVotes = await database
    .select({
      createdAt: featureRequestVote.createdAt,
      requestId: featureRequestVote.requestId,
      workspaceId: featureRequestVote.workspaceId,
    })
    .from(featureRequestVote)
    .where(eq(featureRequestVote.userId, userId))
    .limit(1000);

  // Platform-level growth records are keyed by email/code, not workspaceId.
  const waitlistEntries = profile
    ? await database
        .select({
          createdAt: waitlistEntry.createdAt,
          email: waitlistEntry.email,
          invitedAt: waitlistEntry.invitedAt,
          joinedAt: waitlistEntry.joinedAt,
          referralCode: waitlistEntry.referralCode,
          referralCount: waitlistEntry.referralCount,
          status: waitlistEntry.status,
        })
        .from(waitlistEntry)
        .where(eq(waitlistEntry.email, profile.email))
    : [];

  const growthReferrals = await database
    .select({ code: referral.code, createdAt: referral.createdAt, kind: referral.kind })
    .from(referral)
    .where(eq(referral.referredUserId, userId))
    .limit(1000);

  const redeemedEarlyAccessCodes = await database
    .select({ code: earlyAccessCode.code, redeemedAt: earlyAccessCode.redeemedAt })
    .from(earlyAccessCode)
    .where(eq(earlyAccessCode.redeemedByUserId, userId))
    .limit(1000);

  return Object.freeze({
    accounts,
    apiKeys,
    authoredAuditEvents,
    authoredContentEntries: authoredContent,
    authoredFeatureRequests,
    chatMessages: messages,
    chatThreads: threads,
    connectedAccounts,
    exportedAt: new Date().toISOString(),
    featureVotes,
    format: "supastack-gdpr-export@1",
    growth: { redeemedEarlyAccessCodes, referrals: growthReferrals, waitlistEntries },
    invitations,
    memberships,
    notificationPreferences: preferences,
    notifications,
    profile: profile ?? null,
    sessions,
    uploads,
    workspacePreference: workspacePreference[0] ?? null,
  });
}
