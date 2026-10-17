import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("storage runtime", () => {
  beforeAll(async () => {
    // Import after mocking server-only.
  });

  // The first import can exceed Vitest's 5s default during a cold full-suite Windows run.
  it("reuses one memory object storage for local composition", async () => {
    const { createServerObjectStorage, getSharedMemoryObjectStorage } =
      await import("./storage-runtime.js");
    const first = createServerObjectStorage({ kind: "memory" });
    const second = getSharedMemoryObjectStorage();
    expect(first).toBe(second);

    await first.putObject({
      workspaceId: "ws_1",
      key: "ws_1/avatar/a.png",
      contentType: "image/png",
      body: new Uint8Array([1, 2, 3]),
    });
    const loaded = await second.getObject({ workspaceId: "ws_1", key: "ws_1/avatar/a.png" });
    expect(loaded?.body).toEqual(new Uint8Array([1, 2, 3]));
  }, 15_000);

  it("uses an injected S3 client factory without touching the memory singleton", async () => {
    const { createServerObjectStorage, getSharedMemoryObjectStorage } =
      await import("./storage-runtime.js");
    const calls: string[] = [];
    const storage = createServerObjectStorage(
      {
        kind: "s3",
        accessKeyId: "ak",
        bucket: "kit",
        secretAccessKey: "sk",
        endpoint: "http://127.0.0.1:9000",
        forcePathStyle: true,
        publicBaseUrl: "https://cdn.example.test",
        region: "us-east-1",
      },
      {
        createS3Client(config) {
          calls.push(`factory:${config.bucket}:${config.endpoint}`);
          return {
            async putObject(input) {
              calls.push(`put:${input.Key}`);
            },
            async getObject() {
              return { Body: new Uint8Array([7]), ContentType: "image/png" };
            },
            async deleteObject(input) {
              calls.push(`delete:${input.Key}`);
            },
          };
        },
      },
    );

    await storage.putObject({
      workspaceId: "ws_s3",
      key: "ws_s3/avatar/a.png",
      contentType: "image/png",
      body: new Uint8Array([1]),
    });
    expect(storage.getPublicUrl({ workspaceId: "ws_s3", key: "ws_s3/avatar/a.png" })).toBe(
      "https://cdn.example.test/ws_s3/avatar/a.png",
    );
    expect(calls).toEqual(["factory:kit:http://127.0.0.1:9000", "put:ws_s3/avatar/a.png"]);
    expect(getSharedMemoryObjectStorage()).not.toBe(storage);
  });

  it("builds a default AWS/MinIO-shaped S3 client when factories are omitted", async () => {
    const { createAwsS3CompatibleClient, createServerObjectStorage } =
      await import("./storage-runtime.js");
    const client = createAwsS3CompatibleClient({
      kind: "s3",
      accessKeyId: "ak",
      bucket: "kit",
      secretAccessKey: "sk",
      endpoint: "http://127.0.0.1:9000",
      forcePathStyle: true,
      publicBaseUrl: undefined,
      region: "us-east-1",
    });
    expect(typeof client.putObject).toBe("function");
    expect(typeof client.getObject).toBe("function");
    expect(typeof client.deleteObject).toBe("function");

    const storage = createServerObjectStorage({
      kind: "s3",
      accessKeyId: "ak",
      bucket: "kit",
      secretAccessKey: "sk",
      endpoint: "http://127.0.0.1:9000",
      forcePathStyle: true,
      publicBaseUrl: undefined,
      region: "us-east-1",
    });
    expect(storage.getPublicUrl({ workspaceId: "ws_1", key: "ws_1/avatar/a.png" })).toBe(
      "s3://kit/ws_1/avatar/a.png",
    );
  });
});
