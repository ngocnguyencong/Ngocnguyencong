"use server";

import { randomUUID } from "node:crypto";

import {
  AUDIT_ACTIONS,
  canManageWorkspaceMembers,
  canWriteWorkspace,
  featureRequest,
  featureRequestVote,
} from "@supastack/db";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "./audit-runtime";
import { database } from "./auth-runtime";
import {
  evaluateFeatureStatusChange,
  isFeatureRequestStatus,
  normalizeFeatureRequestInput,
  type FeatureRequestStatus,
} from "./feature-board";
import {
  insertFeatureRequestWithAuthorVote,
  toggleFeatureRequestVote,
} from "./feature-board-store";
import {
  requireWorkspaceManager,
  requireWorkspaceViewer,
  requireWorkspaceWriter,
} from "./workspace-access";
import { tryEmitWorkspaceEvent } from "./webhook-delivery";

export interface FeatureRequestRow {
  createdAt: Date;
  details: string;
  id: string;
  mine: boolean;
  status: FeatureRequestStatus;
  title: string;
  voteCount: number;
}

const FEEDBACK_PAGE_PATH = "/feedback";

/**
 * Board for the active workspace, most-voted first. Guests can read but
 * `canWrite`/`canManage` tell the UI which affordances to offer.
 */
export async function listFeatureRequests(): Promise<{
  canManage: boolean;
  canWrite: boolean;
  error?: string;
  myVoteIds: string[];
  requests: FeatureRequestRow[];
}> {
  const context = await requireWorkspaceViewer();
  if ("error" in context) {
    return {
      canManage: false,
      canWrite: false,
      error: context.error,
      myVoteIds: [],
      requests: [],
    };
  }
  const rows = await database
    .select({
      createdAt: featureRequest.createdAt,
      createdBy: featureRequest.createdBy,
      details: featureRequest.details,
      id: featureRequest.id,
      status: featureRequest.status,
      title: featureRequest.title,
      voteCount: featureRequest.voteCount,
    })
    .from(featureRequest)
    .where(eq(featureRequest.workspaceId, context.workspaceId))
    .orderBy(desc(featureRequest.voteCount), desc(featureRequest.createdAt))
    .limit(500);
  const votes = await database
    .select({ requestId: featureRequestVote.requestId })
    .from(featureRequestVote)
    .where(
      and(
        eq(featureRequestVote.workspaceId, context.workspaceId),
        eq(featureRequestVote.userId, context.userId),
      ),
    );
  return {
    canManage: canManageWorkspaceMembers(context.role),
    canWrite: canWriteWorkspace(context.role),
    myVoteIds: votes.map((vote) => vote.requestId),
    requests: rows.map((row) => ({
      createdAt: row.createdAt,
      details: row.details,
      id: row.id,
      mine: row.createdBy === context.userId,
      status: isFeatureRequestStatus(row.status) ? row.status : "open",
      title: row.title,
      voteCount: row.voteCount,
    })),
  };
}

export type FeatureBoardActionResult =
  { error: string; ok: false } | { ok: true; requestId: string };

/** Submit a request; the author's own vote lands in the same transaction. */
export async function createFeatureRequestAction(input: {
  details?: string;
  title?: string;
}): Promise<FeatureBoardActionResult> {
  const context = await requireWorkspaceWriter();
  if ("error" in context) {
    return { error: context.error, ok: false };
  }
  const normalized = normalizeFeatureRequestInput(input);
  if ("error" in normalized) {
    return { error: normalized.error, ok: false };
  }
  const requestId = `fr_${randomUUID()}`;
  await insertFeatureRequestWithAuthorVote({
    details: normalized.details,
    id: requestId,
    now: new Date(),
    title: normalized.title,
    userId: context.userId,
    workspaceId: context.workspaceId,
  });
  await recordAuditEvent({
    action: AUDIT_ACTIONS.featureRequestCreated,
    actorUserId: context.userId,
    metadata: { title: normalized.title },
    targetId: requestId,
    targetType: "feature_request",
    workspaceId: context.workspaceId,
  });
  await tryEmitWorkspaceEvent({
    data: { requestId, title: normalized.title },
    eventType: "feature_request.created",
    workspaceId: context.workspaceId,
  });
  revalidatePath(FEEDBACK_PAGE_PATH);
  return { ok: true, requestId };
}

export type VoteToggleResult =
  { error: string; ok: false } | { ok: true; voteCount: number; voted: boolean };

/** Toggle the caller's vote; the composite PK makes double-voting impossible. */
export async function toggleFeatureRequestVoteAction(input: {
  requestId: string;
}): Promise<VoteToggleResult> {
  const context = await requireWorkspaceWriter();
  if ("error" in context) {
    return { error: context.error, ok: false };
  }
  const result = await toggleFeatureRequestVote({
    requestId: input.requestId,
    userId: context.userId,
    workspaceId: context.workspaceId,
  });
  if (result === null) {
    return { error: "Feature request not found.", ok: false };
  }
  revalidatePath(FEEDBACK_PAGE_PATH);
  return { ok: true, voteCount: result.voteCount, voted: result.voted };
}

/** Form action — owner/admin moves a request between lifecycle states. */
export async function setFeatureRequestStatusAction(formData: FormData): Promise<void> {
  const context = await requireWorkspaceManager();
  if ("error" in context) {
    revalidatePath(FEEDBACK_PAGE_PATH);
    return;
  }
  const requestId = formData.get("requestId");
  const next = formData.get("status");
  if (typeof requestId !== "string" || typeof next !== "string") {
    return;
  }
  const [current] = await database
    .select({ status: featureRequest.status })
    .from(featureRequest)
    .where(
      and(eq(featureRequest.id, requestId), eq(featureRequest.workspaceId, context.workspaceId)),
    )
    .limit(1);
  if (current === undefined) {
    return;
  }
  const decision = evaluateFeatureStatusChange(current, next);
  if (!decision.ok) {
    revalidatePath(FEEDBACK_PAGE_PATH);
    return;
  }
  await database
    .update(featureRequest)
    .set({ status: decision.status, updatedAt: new Date() })
    .where(
      and(eq(featureRequest.id, requestId), eq(featureRequest.workspaceId, context.workspaceId)),
    );
  await recordAuditEvent({
    action: AUDIT_ACTIONS.featureRequestStatusChanged,
    actorUserId: context.userId,
    metadata: { from: current.status, to: decision.status },
    targetId: requestId,
    targetType: "feature_request",
    workspaceId: context.workspaceId,
  });
  await tryEmitWorkspaceEvent({
    data: { requestId, status: decision.status },
    eventType: "feature_request.status_changed",
    workspaceId: context.workspaceId,
  });
  revalidatePath(FEEDBACK_PAGE_PATH);
}

/** Owner/admin moderation delete; votes cascade with the request row. */
export async function deleteFeatureRequestAction(formData: FormData): Promise<void> {
  const context = await requireWorkspaceManager();
  if ("error" in context) {
    revalidatePath(FEEDBACK_PAGE_PATH);
    return;
  }
  const requestId = formData.get("requestId");
  if (typeof requestId !== "string" || requestId.length === 0) {
    return;
  }
  await database
    .delete(featureRequest)
    .where(
      and(eq(featureRequest.id, requestId), eq(featureRequest.workspaceId, context.workspaceId)),
    );
  await recordAuditEvent({
    action: AUDIT_ACTIONS.featureRequestDeleted,
    actorUserId: context.userId,
    targetId: requestId,
    targetType: "feature_request",
    workspaceId: context.workspaceId,
  });
  revalidatePath(FEEDBACK_PAGE_PATH);
}
