export type StoredObject = Readonly<{
  workspaceId: string;
  key: string;
  contentType: string;
  body: Uint8Array;
}>;

export type PutObjectInput = Readonly<{
  workspaceId: string;
  key: string;
  contentType: string;
  body: Uint8Array;
}>;

export type ObjectLocator = Readonly<{
  workspaceId: string;
  key: string;
}>;

export interface ObjectStorage {
  putObject(input: PutObjectInput): Promise<StoredObject>;
  getObject(input: ObjectLocator): Promise<StoredObject | undefined>;
  deleteObject(input: ObjectLocator): Promise<boolean>;
  getPublicUrl(input: ObjectLocator): string;
}

export class WorkspaceScopedStorageError extends Error {
  constructor() {
    super("Storage object keys must stay under the owning workspace prefix.");
    this.name = "WorkspaceScopedStorageError";
  }
}

export function assertWorkspaceObjectKey(workspaceId: string, key: string): string {
  const normalized = key.replace(/^\/+/, "");
  const prefix = `${workspaceId}/`;
  if (!normalized.startsWith(prefix) || normalized.includes("..")) {
    throw new WorkspaceScopedStorageError();
  }
  return normalized;
}

export type WorkspaceObjectPurpose = "avatar" | "file" | "logo";

export function buildWorkspaceObjectKey(
  workspaceId: string,
  purpose: WorkspaceObjectPurpose,
  fileName: string,
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "object";
  return `${workspaceId}/${purpose}/${safeName}`;
}

function cloneStored(object: StoredObject): StoredObject {
  return {
    workspaceId: object.workspaceId,
    key: object.key,
    contentType: object.contentType,
    body: Uint8Array.from(object.body),
  };
}

/** Deterministic in-memory adapter for offline tests and local composition. */
export class MemoryObjectStorage implements ObjectStorage {
  private readonly objects = new Map<string, StoredObject>();

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    const key = assertWorkspaceObjectKey(input.workspaceId, input.key);
    const stored: StoredObject = {
      workspaceId: input.workspaceId,
      key,
      contentType: input.contentType,
      body: Uint8Array.from(input.body),
    };
    this.objects.set(`${input.workspaceId}:${key}`, stored);
    return cloneStored(stored);
  }

  async getObject(input: ObjectLocator): Promise<StoredObject | undefined> {
    const key = assertWorkspaceObjectKey(input.workspaceId, input.key);
    const stored = this.objects.get(`${input.workspaceId}:${key}`);
    return stored ? cloneStored(stored) : undefined;
  }

  async deleteObject(input: ObjectLocator): Promise<boolean> {
    const key = assertWorkspaceObjectKey(input.workspaceId, input.key);
    return this.objects.delete(`${input.workspaceId}:${key}`);
  }

  getPublicUrl(input: ObjectLocator): string {
    const key = assertWorkspaceObjectKey(input.workspaceId, input.key);
    return `/api/storage/objects?workspaceId=${encodeURIComponent(input.workspaceId)}&key=${encodeURIComponent(key)}`;
  }
}

/**
 * Minimal S3-compatible surface. The web edge injects an AWS SDK client; this
 * package never receives access keys.
 */
export interface S3CompatibleClient {
  putObject(input: {
    Bucket: string;
    Key: string;
    ContentType: string;
    Body: Uint8Array;
  }): Promise<void>;
  getObject(input: {
    Bucket: string;
    Key: string;
  }): Promise<{ Body?: Uint8Array; ContentType?: string } | undefined>;
  deleteObject(input: { Bucket: string; Key: string }): Promise<void>;
}

export class S3CompatibleObjectStorage implements ObjectStorage {
  constructor(
    private readonly client: S3CompatibleClient,
    private readonly bucket: string,
    private readonly publicBaseUrl?: string,
  ) {}

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    const key = assertWorkspaceObjectKey(input.workspaceId, input.key);
    await this.client.putObject({
      Bucket: this.bucket,
      Key: key,
      ContentType: input.contentType,
      Body: Uint8Array.from(input.body),
    });
    return {
      workspaceId: input.workspaceId,
      key,
      contentType: input.contentType,
      body: Uint8Array.from(input.body),
    };
  }

  async getObject(input: ObjectLocator): Promise<StoredObject | undefined> {
    const key = assertWorkspaceObjectKey(input.workspaceId, input.key);
    const result = await this.client.getObject({ Bucket: this.bucket, Key: key });
    if (!result?.Body) {
      return undefined;
    }
    return {
      workspaceId: input.workspaceId,
      key,
      contentType: result.ContentType ?? "application/octet-stream",
      body: Uint8Array.from(result.Body),
    };
  }

  async deleteObject(input: ObjectLocator): Promise<boolean> {
    const key = assertWorkspaceObjectKey(input.workspaceId, input.key);
    await this.client.deleteObject({ Bucket: this.bucket, Key: key });
    return true;
  }

  getPublicUrl(input: ObjectLocator): string {
    const key = assertWorkspaceObjectKey(input.workspaceId, input.key);
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/$/, "")}/${key}`;
    }
    return `s3://${this.bucket}/${key}`;
  }
}
