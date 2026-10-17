import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildWorkspaceObjectKey, MemoryObjectStorage } from "@supastack/storage";

import {
  MAX_LEGACY_IMAGE_CLEANUP_PER_UPLOAD,
  replaceWorkspaceImage,
} from "./storage-image-lifecycle";

type Purpose = "avatar" | "logo";
type Row = {
  id: string;
  workspaceId: string;
  userId: string | null;
  objectKey: string;
  contentType: string;
  byteSize: number;
  purpose: string;
  createdAt: Date;
  updatedAt: Date;
};

class MemoryImageRepository {
  readonly rows: Row[] = [];
  private readonly locks = new Map<string, Promise<void>>();
  private nextId = 0;

  async withSlotLock<T>(
    slot: string,
    work: (transaction: { upsertCurrent: (row: Row) => Promise<void> }) => Promise<T>,
  ): Promise<T> {
    const previous = this.locks.get(slot) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => (release = resolve));
    this.locks.set(slot, current);
    await previous;
    try {
      return await work({
        upsertCurrent: async (row) => {
          const existing = this.rows.find(
            (candidate) =>
              candidate.workspaceId === row.workspaceId && candidate.objectKey === row.objectKey,
          );
          if (existing) Object.assign(existing, row);
          else this.rows.push({ ...row, id: `obj_test_${++this.nextId}` });
        },
      });
    } finally {
      release();
      if (this.locks.get(slot) === current) this.locks.delete(slot);
    }
  }

  async listObsolete(input: {
    workspaceId: string;
    userId: string;
    purpose: Purpose;
    currentKey: string;
    limit: number;
  }): Promise<Array<Pick<Row, "workspaceId" | "objectKey">>> {
    return this.rows
      .filter(
        (row) =>
          row.workspaceId === input.workspaceId &&
          row.purpose === input.purpose &&
          row.objectKey !== input.currentKey &&
          (input.purpose === "logo" || row.userId === input.userId),
      )
      .slice(0, input.limit)
      .map(({ workspaceId, objectKey }) => ({ workspaceId, objectKey }));
  }

  async deleteMetadata(input: { workspaceId: string; objectKey: string }): Promise<void> {
    const index = this.rows.findIndex(
      (row) => row.workspaceId === input.workspaceId && row.objectKey === input.objectKey,
    );
    if (index >= 0) this.rows.splice(index, 1);
  }

  seed(row: Row): void {
    this.rows.push(row);
  }
}

function row(workspaceId: string, userId: string | null, purpose: string, name: string): Row {
  const now = new Date("2026-10-03T12:00:00.000Z");
  return {
    id: `seed_${name}`,
    workspaceId,
    userId,
    objectKey: buildWorkspaceObjectKey(workspaceId, purpose as Purpose, name),
    contentType: "image/png",
    byteSize: 1,
    purpose,
    createdAt: now,
    updatedAt: now,
  };
}

function upload(purpose: Purpose, body = Uint8Array.from([1, 2, 3])) {
  return {
    workspaceId: "ws_1",
    userId: "user_1",
    purpose,
    contentType: "image/png",
    body,
  } as const;
}

describe("replaceWorkspaceImage", () => {
  let storage: MemoryObjectStorage;
  let repository: MemoryImageRepository;

  beforeEach(() => {
    storage = new MemoryObjectStorage();
    repository = new MemoryImageRepository();
  });

  it("overwrites one stable avatar slot and one metadata row on repeated uploads", async () => {
    const firstKey = await replaceWorkspaceImage(upload("avatar", Uint8Array.from([1])), {
      storage,
      repository,
    });
    const secondKey = await replaceWorkspaceImage(upload("avatar", Uint8Array.from([2, 3])), {
      storage,
      repository,
    });

    expect(firstKey).toBe(secondKey);
    expect(firstKey).toBe(buildWorkspaceObjectKey("ws_1", "avatar", "user_1"));
    expect(repository.rows).toHaveLength(1);
    expect(repository.rows[0]).toEqual(
      expect.objectContaining({ byteSize: 2, objectKey: firstKey, userId: "user_1" }),
    );
    await expect(storage.getObject({ workspaceId: "ws_1", key: firstKey })).resolves.toEqual(
      expect.objectContaining({ body: Uint8Array.from([2, 3]) }),
    );
  });

  it("cleans avatar history only for the same workspace, user, and purpose", async () => {
    const ownerAvatar = row("ws_1", "user_1", "avatar", "old-owner.png");
    const otherUserAvatar = row("ws_1", "user_2", "avatar", "other-user.png");
    const otherWorkspaceAvatar = row("ws_2", "user_1", "avatar", "other-workspace.png");
    const ownerFile = row("ws_1", "user_1", "file", "owner-file.png");
    for (const seed of [ownerAvatar, otherUserAvatar, otherWorkspaceAvatar, ownerFile]) {
      repository.seed(seed);
      await storage.putObject({
        workspaceId: seed.workspaceId,
        key: seed.objectKey,
        contentType: seed.contentType,
        body: Uint8Array.from([1]),
      });
    }

    await replaceWorkspaceImage(upload("avatar"), { storage, repository });

    expect(repository.rows.map((entry) => entry.objectKey)).toEqual(
      expect.arrayContaining([
        otherUserAvatar.objectKey,
        otherWorkspaceAvatar.objectKey,
        ownerFile.objectKey,
      ]),
    );
    expect(repository.rows.map((entry) => entry.objectKey)).not.toContain(ownerAvatar.objectKey);
    await expect(
      storage.getObject({ workspaceId: "ws_1", key: ownerAvatar.objectKey }),
    ).resolves.toBeUndefined();
  });

  it("scopes logo cleanup to its workspace and purpose rather than uploader", async () => {
    const olderLogo = row("ws_1", "former_admin", "logo", "old-logo.png");
    const otherWorkspaceLogo = row("ws_2", "user_1", "logo", "other-logo.png");
    const workspaceFile = row("ws_1", "user_1", "file", "workspace-file.png");
    for (const seed of [olderLogo, otherWorkspaceLogo, workspaceFile]) {
      repository.seed(seed);
      await storage.putObject({
        workspaceId: seed.workspaceId,
        key: seed.objectKey,
        contentType: seed.contentType,
        body: Uint8Array.from([1]),
      });
    }

    await replaceWorkspaceImage(upload("logo"), { storage, repository });

    expect(repository.rows.map((entry) => entry.objectKey)).toEqual(
      expect.arrayContaining([otherWorkspaceLogo.objectKey, workspaceFile.objectKey]),
    );
    expect(repository.rows.map((entry) => entry.objectKey)).not.toContain(olderLogo.objectKey);
  });

  it("caps legacy cleanup work per upload and retains metadata when object deletion fails", async () => {
    const legacy = Array.from({ length: MAX_LEGACY_IMAGE_CLEANUP_PER_UPLOAD + 4 }, (_, index) =>
      row("ws_1", "user_1", "avatar", `legacy-${index}.png`),
    );
    for (const seed of legacy) repository.seed(seed);
    vi.spyOn(storage, "deleteObject").mockRejectedValueOnce(new Error("storage unavailable"));

    await replaceWorkspaceImage(upload("avatar"), { storage, repository });

    expect(storage.deleteObject).toHaveBeenCalledTimes(MAX_LEGACY_IMAGE_CLEANUP_PER_UPLOAD);
    expect(repository.rows).toHaveLength(6);
    expect(repository.rows.some((entry) => entry.objectKey === legacy[0]!.objectKey)).toBe(true);
  });

  it("serializes concurrent replacements so the object and metadata describe the same winner", async () => {
    await Promise.all([
      replaceWorkspaceImage(upload("avatar", Uint8Array.from([1])), { storage, repository }),
      replaceWorkspaceImage(upload("avatar", Uint8Array.from([2, 3, 4, 5])), {
        storage,
        repository,
      }),
    ]);

    const currentKey = buildWorkspaceObjectKey("ws_1", "avatar", "user_1");
    const stored = await storage.getObject({ workspaceId: "ws_1", key: currentKey });
    expect(repository.rows).toHaveLength(1);
    expect(repository.rows[0]?.objectKey).toBe(currentKey);
    expect(repository.rows[0]?.byteSize).toBe(stored?.body.byteLength);
  });
});
