import "server-only";

import { featureRequest, featureRequestVote } from "@supastack/db";
import { and, eq } from "drizzle-orm";

import { database } from "./auth-runtime";
import { nextVoteCount } from "./feature-board";

/**
 * Shared board writes for server actions and the mobile BFF routes — the
 * request row and its vote counter always change inside one transaction.
 */

/** Insert a request together with the author's own vote (Canny-style). */
export async function insertFeatureRequestWithAuthorVote(input: {
  details: string;
  id: string;
  now: Date;
  title: string;
  userId: string;
  workspaceId: string;
}): Promise<void> {
  await database.transaction(async (tx) => {
    await tx.insert(featureRequest).values({
      createdAt: input.now,
      createdBy: input.userId,
      details: input.details,
      id: input.id,
      status: "open",
      title: input.title,
      updatedAt: input.now,
      voteCount: 1,
      workspaceId: input.workspaceId,
    });
    await tx.insert(featureRequestVote).values({
      createdAt: input.now,
      requestId: input.id,
      userId: input.userId,
      workspaceId: input.workspaceId,
    });
  });
}

/**
 * Toggle one member's vote. Returns null when the request does not belong to
 * the workspace; otherwise the fresh `{voted, voteCount}`.
 */
export async function toggleFeatureRequestVote(input: {
  requestId: string;
  userId: string;
  workspaceId: string;
}): Promise<{ voteCount: number; voted: boolean } | null> {
  return database.transaction(async (tx) => {
    const [current] = await tx
      .select({ voteCount: featureRequest.voteCount })
      .from(featureRequest)
      .where(
        and(
          eq(featureRequest.id, input.requestId),
          eq(featureRequest.workspaceId, input.workspaceId),
        ),
      )
      .limit(1);
    if (current === undefined) {
      return null;
    }
    const removed = await tx
      .delete(featureRequestVote)
      .where(
        and(
          eq(featureRequestVote.requestId, input.requestId),
          eq(featureRequestVote.userId, input.userId),
        ),
      )
      .returning({ requestId: featureRequestVote.requestId });
    const voted = removed.length === 0;
    if (voted) {
      await tx.insert(featureRequestVote).values({
        createdAt: new Date(),
        requestId: input.requestId,
        userId: input.userId,
        workspaceId: input.workspaceId,
      });
    }
    const voteCount = nextVoteCount(current.voteCount, !voted);
    await tx
      .update(featureRequest)
      .set({ voteCount })
      .where(
        and(
          eq(featureRequest.id, input.requestId),
          eq(featureRequest.workspaceId, input.workspaceId),
        ),
      );
    return { voteCount, voted };
  });
}
