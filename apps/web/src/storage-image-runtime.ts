import "server-only";

import { storedObject } from "@supastack/db";
import { and, asc, eq, ne, sql } from "drizzle-orm";

import { database } from "./auth-runtime";
import { createServerObjectStorage } from "./storage-runtime";
import {
  replaceWorkspaceImage,
  type StorageImageRepository,
  type WorkspaceImageMetadata,
  type WorkspaceImagePurpose,
} from "./storage-image-lifecycle";

const repository: StorageImageRepository = {
  async withSlotLock(slotKey, operation) {
    return database.transaction(async (transaction) => {
      // A transaction-scoped lock serializes stable-key writes across app
      // instances without retaining process-local owner state.
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${slotKey}))`);
      return operation({
        async upsertCurrent(metadata: WorkspaceImageMetadata) {
          const now = metadata.updatedAt;
          await transaction
            .insert(storedObject)
            .values({
              id: metadata.id,
              workspaceId: metadata.workspaceId,
              userId: metadata.userId,
              objectKey: metadata.objectKey,
              contentType: metadata.contentType,
              byteSize: metadata.byteSize,
              purpose: metadata.purpose,
              createdAt: now,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: [storedObject.workspaceId, storedObject.objectKey],
              set: {
                userId: metadata.userId,
                contentType: metadata.contentType,
                byteSize: metadata.byteSize,
                purpose: metadata.purpose,
                createdAt: now,
                updatedAt: now,
              },
            });
        },
      });
    });
  },
  async listObsolete({ workspaceId, userId, purpose, currentKey, limit }) {
    const conditions = [
      eq(storedObject.workspaceId, workspaceId),
      eq(storedObject.purpose, purpose),
      ne(storedObject.objectKey, currentKey),
    ];
    if (purpose === "avatar") conditions.push(eq(storedObject.userId, userId));
    return database
      .select({ workspaceId: storedObject.workspaceId, objectKey: storedObject.objectKey })
      .from(storedObject)
      .where(and(...conditions))
      .orderBy(asc(storedObject.createdAt))
      .limit(limit);
  },
  async deleteMetadata({ workspaceId, objectKey }) {
    await database
      .delete(storedObject)
      .where(and(eq(storedObject.workspaceId, workspaceId), eq(storedObject.objectKey, objectKey)));
  },
};

export async function replaceStoredWorkspaceImage(input: {
  workspaceId: string;
  userId: string;
  purpose: WorkspaceImagePurpose;
  contentType: string;
  body: Uint8Array;
}): Promise<{ key: string; url: string }> {
  const storage = createServerObjectStorage();
  const key = await replaceWorkspaceImage(input, { storage, repository });
  return {
    key,
    url: storage.getPublicUrl({ workspaceId: input.workspaceId, key }),
  };
}
