import { randomUUID } from "node:crypto";

import { buildWorkspaceObjectKey, type ObjectStorage } from "@supastack/storage";

export const MAX_LEGACY_IMAGE_CLEANUP_PER_UPLOAD = 25;

export type WorkspaceImagePurpose = "avatar" | "logo";

export type WorkspaceImageMetadata = Readonly<{
  id: string;
  workspaceId: string;
  userId: string;
  objectKey: string;
  contentType: string;
  byteSize: number;
  purpose: WorkspaceImagePurpose;
  createdAt: Date;
  updatedAt: Date;
}>;

export type ObsoleteWorkspaceImage = Readonly<{
  workspaceId: string;
  objectKey: string;
}>;

export interface StorageImageTransaction {
  upsertCurrent(metadata: WorkspaceImageMetadata): Promise<void>;
}

export interface StorageImageRepository {
  withSlotLock<T>(
    slotKey: string,
    operation: (transaction: StorageImageTransaction) => Promise<T>,
  ): Promise<T>;
  listObsolete(input: {
    workspaceId: string;
    userId: string;
    purpose: WorkspaceImagePurpose;
    currentKey: string;
    limit: number;
  }): Promise<ObsoleteWorkspaceImage[]>;
  deleteMetadata(input: ObsoleteWorkspaceImage): Promise<void>;
}

export type ReplaceWorkspaceImageInput = Readonly<{
  workspaceId: string;
  userId: string;
  purpose: WorkspaceImagePurpose;
  contentType: string;
  body: Uint8Array;
}>;

export type StorageImageLifecycleDependencies = Readonly<{
  storage: ObjectStorage;
  repository: StorageImageRepository;
  now?: () => Date;
}>;

/**
 * Overwrites one logical image slot, serializing the object and metadata
 * update through the repository's transaction lock. Legacy timestamped
 * objects are cleaned in a capped, owner-scoped batch after commit.
 */
export async function replaceWorkspaceImage(
  input: ReplaceWorkspaceImageInput,
  dependencies: StorageImageLifecycleDependencies,
): Promise<string> {
  const fileName = input.purpose === "avatar" ? input.userId : "current";
  const key = buildWorkspaceObjectKey(input.workspaceId, input.purpose, fileName);
  const slotKey = JSON.stringify([
    input.workspaceId,
    input.purpose,
    input.purpose === "avatar" ? input.userId : null,
  ]);

  await dependencies.repository.withSlotLock(slotKey, async (transaction) => {
    await dependencies.storage.putObject({
      workspaceId: input.workspaceId,
      key,
      contentType: input.contentType,
      body: input.body,
    });
    const now = (dependencies.now ?? (() => new Date()))();
    await transaction.upsertCurrent({
      id: `obj_${randomUUID()}`,
      workspaceId: input.workspaceId,
      userId: input.userId,
      objectKey: key,
      contentType: input.contentType,
      byteSize: input.body.byteLength,
      purpose: input.purpose,
      createdAt: now,
      updatedAt: now,
    });
  });

  try {
    const obsolete = await dependencies.repository.listObsolete({
      workspaceId: input.workspaceId,
      userId: input.userId,
      purpose: input.purpose,
      currentKey: key,
      limit: MAX_LEGACY_IMAGE_CLEANUP_PER_UPLOAD,
    });
    for (const entry of obsolete) {
      // Treat the repository as a trust boundary too: never delete the current
      // object or an object outside the authorized workspace scope.
      if (entry.workspaceId !== input.workspaceId || entry.objectKey === key) continue;
      try {
        await dependencies.storage.deleteObject({
          workspaceId: input.workspaceId,
          key: entry.objectKey,
        });
        await dependencies.repository.deleteMetadata(entry);
      } catch {
        // Keep the metadata row so a later successful upload can retry cleanup.
      }
    }
  } catch {
    // A cleanup query failure does not undo the image replacement. The next
    // upload retries a bounded batch.
  }

  return key;
}
