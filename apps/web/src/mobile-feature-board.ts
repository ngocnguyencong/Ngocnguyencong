import "server-only";

import { randomUUID } from "node:crypto";

import {
  featureRequest,
  featureRequestVote,
  normalizeWorkspaceRole,
  workspaceMembership,
} from "@supastack/db";
import { and, desc, eq } from "drizzle-orm";

import { recordAuditEvent } from "./audit-runtime";
import { database, getAuthSession } from "./auth-runtime";
import { isFeatureRequestStatus } from "./feature-board";
import {
  insertFeatureRequestWithAuthorVote,
  toggleFeatureRequestVote,
} from "./feature-board-store";
import { createMobileFeatureBoardBff, type MobileFeatureRequest } from "./mobile-feature-board-bff";
import { resolveActiveWorkspaceIdForUser } from "./organization-actions";
import { tryEmitWorkspaceEvent } from "./webhook-delivery";

function toMobileRequest(
  row: {
    createdAt: Date;
    createdBy: string | null;
    details: string;
    id: string;
    status: string;
    title: string;
    voteCount: number;
  },
  userId: string,
): MobileFeatureRequest {
  return {
    createdAt: row.createdAt.toISOString(),
    details: row.details,
    id: row.id,
    mine: row.createdBy === userId,
    status: isFeatureRequestStatus(row.status) ? row.status : "open",
    title: row.title,
    voteCount: row.voteCount,
  };
}

/** Drizzle/session wiring for `/api/mobile/feature-requests*`. */
export const mobileFeatureBoardBff = createMobileFeatureBoardBff({
  createRequest: async ({ details, title, userId, workspaceId }) => {
    const requestId = `fr_${randomUUID()}`;
    const now = new Date();
    await insertFeatureRequestWithAuthorVote({
      details,
      id: requestId,
      now,
      title,
      userId,
      workspaceId,
    });
    await recordAuditEvent({
      action: "feature_request.created",
      actorUserId: userId,
      metadata: { title },
      targetId: requestId,
      targetType: "feature_request",
      workspaceId,
    });
    await tryEmitWorkspaceEvent({
      data: { requestId, title },
      eventType: "feature_request.created",
      workspaceId,
    });
    return {
      request: {
        createdAt: now.toISOString(),
        details,
        id: requestId,
        mine: true,
        status: "open",
        title,
        voteCount: 1,
      },
    };
  },
  getSession: (headers) => getAuthSession(headers),
  listRequests: async ({ userId, workspaceId }) => {
    const rows = await database
      .select()
      .from(featureRequest)
      .where(eq(featureRequest.workspaceId, workspaceId))
      .orderBy(desc(featureRequest.voteCount), desc(featureRequest.createdAt))
      .limit(500);
    const votes = await database
      .select({ requestId: featureRequestVote.requestId })
      .from(featureRequestVote)
      .where(
        and(eq(featureRequestVote.workspaceId, workspaceId), eq(featureRequestVote.userId, userId)),
      );
    return {
      requests: rows.map((row) => toMobileRequest(row, userId)),
      votedRequestIds: votes.map((vote) => vote.requestId),
    };
  },
  resolveWorkspace: async (userId) => {
    const workspaceId = await resolveActiveWorkspaceIdForUser(userId);
    if (workspaceId === undefined) {
      return null;
    }
    const [membership] = await database
      .select({ role: workspaceMembership.role })
      .from(workspaceMembership)
      .where(
        and(
          eq(workspaceMembership.workspaceId, workspaceId),
          eq(workspaceMembership.userId, userId),
        ),
      )
      .limit(1);
    if (membership === undefined) {
      return null;
    }
    return { role: normalizeWorkspaceRole(membership.role), workspaceId };
  },
  toggleVote: (input) => toggleFeatureRequestVote(input),
});
