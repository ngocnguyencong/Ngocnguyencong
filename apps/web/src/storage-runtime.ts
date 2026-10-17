import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { parseServerConfig, type ServerConfig } from "@supastack/config";
import {
  MemoryObjectStorage,
  S3CompatibleObjectStorage,
  type ObjectStorage,
  type S3CompatibleClient,
} from "@supastack/storage";

type S3Config = Extract<ServerConfig["providers"]["storage"], { kind: "s3" }>;

export interface ObjectStorageFactories {
  createS3Client(config: S3Config): S3CompatibleClient;
}

let sharedMemoryStorage: MemoryObjectStorage | undefined;

export function getSharedMemoryObjectStorage(): MemoryObjectStorage {
  sharedMemoryStorage ??= new MemoryObjectStorage();
  return sharedMemoryStorage;
}

async function bodyToUint8Array(body: unknown): Promise<Uint8Array | undefined> {
  if (body === undefined || body === null) {
    return undefined;
  }
  if (body instanceof Uint8Array) {
    return body;
  }
  if (typeof body === "object" && "transformToByteArray" in body) {
    return await (body as { transformToByteArray(): Promise<Uint8Array> }).transformToByteArray();
  }
  return undefined;
}

/**
 * AWS SDK / MinIO client at the web composition edge. Secrets stay on this
 * factory; `@supastack/storage` only sees the narrow S3-compatible surface.
 */
export function createAwsS3CompatibleClient(config: S3Config): S3CompatibleClient {
  const client = new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    region: config.region,
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    ...(config.forcePathStyle ? { forcePathStyle: true } : {}),
  });

  return {
    async putObject(input) {
      await client.send(
        new PutObjectCommand({
          Bucket: input.Bucket,
          Key: input.Key,
          ContentType: input.ContentType,
          Body: input.Body,
        }),
      );
    },
    async getObject(input) {
      try {
        const result = await client.send(
          new GetObjectCommand({
            Bucket: input.Bucket,
            Key: input.Key,
          }),
        );
        const body = await bodyToUint8Array(result.Body);
        if (!body) {
          return undefined;
        }
        return {
          Body: body,
          ...(result.ContentType === undefined ? {} : { ContentType: result.ContentType }),
        };
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "name" in error &&
          (error as { name: string }).name === "NoSuchKey"
        ) {
          return undefined;
        }
        throw error;
      }
    },
    async deleteObject(input) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: input.Bucket,
          Key: input.Key,
        }),
      );
    },
  };
}

export const defaultObjectStorageFactories: ObjectStorageFactories = {
  createS3Client: createAwsS3CompatibleClient,
};

export function createServerObjectStorage(
  config: ServerConfig["providers"]["storage"] = parseServerConfig().providers.storage,
  factories: ObjectStorageFactories = defaultObjectStorageFactories,
): ObjectStorage {
  if (config.kind === "memory") {
    return getSharedMemoryObjectStorage();
  }

  return new S3CompatibleObjectStorage(
    factories.createS3Client(config),
    config.bucket,
    config.publicBaseUrl,
  );
}
