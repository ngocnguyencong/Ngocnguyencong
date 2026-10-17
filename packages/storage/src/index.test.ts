import { describe, expect, it } from "vitest";

import {
  assertWorkspaceObjectKey,
  buildWorkspaceObjectKey,
  MemoryObjectStorage,
  S3CompatibleObjectStorage,
  WorkspaceScopedStorageError,
  type S3CompatibleClient,
} from "./index.js";

describe("@supastack/storage", () => {
  it("rejects keys that escape the workspace prefix", () => {
    expect(() => assertWorkspaceObjectKey("ws_1", "other/avatar.png")).toThrow(
      WorkspaceScopedStorageError,
    );
    expect(() => assertWorkspaceObjectKey("ws_1", "ws_1/../secret")).toThrow(
      WorkspaceScopedStorageError,
    );
    expect(assertWorkspaceObjectKey("ws_1", "/ws_1/avatar/a.png")).toBe("ws_1/avatar/a.png");
  });

  it("builds workspace-scoped avatar keys", () => {
    expect(buildWorkspaceObjectKey("ws_9", "avatar", "Me Photo!!.png")).toBe(
      "ws_9/avatar/Me-Photo-.png",
    );
  });

  it("stores and serves objects only inside the owning workspace", async () => {
    const storage = new MemoryObjectStorage();
    const body = new TextEncoder().encode("avatar-bytes");
    const stored = await storage.putObject({
      workspaceId: "ws_a",
      key: "ws_a/avatar/head.png",
      contentType: "image/png",
      body,
    });

    expect(stored.key).toBe("ws_a/avatar/head.png");
    expect(storage.getPublicUrl({ workspaceId: "ws_a", key: stored.key })).toContain(
      "workspaceId=ws_a",
    );

    const loaded = await storage.getObject({ workspaceId: "ws_a", key: stored.key });
    expect(loaded?.contentType).toBe("image/png");
    expect(Array.from(loaded?.body ?? [])).toEqual(Array.from(body));

    expect(await storage.getObject({ workspaceId: "ws_b", key: "ws_b/avatar/head.png" })).toBe(
      undefined,
    );
    expect(await storage.deleteObject({ workspaceId: "ws_a", key: stored.key })).toBe(true);
  });

  it("delegates to an injected S3-compatible client without holding secrets", async () => {
    const calls: string[] = [];
    const client: S3CompatibleClient = {
      async putObject(input) {
        calls.push(`put:${input.Bucket}:${input.Key}:${input.ContentType}`);
      },
      async getObject(input) {
        calls.push(`get:${input.Key}`);
        return { Body: new Uint8Array([1, 2]), ContentType: "image/png" };
      },
      async deleteObject(input) {
        calls.push(`delete:${input.Key}`);
      },
    };

    const storage = new S3CompatibleObjectStorage(client, "kit-bucket", "https://cdn.example.test");
    await storage.putObject({
      workspaceId: "ws_1",
      key: "ws_1/avatar/a.png",
      contentType: "image/png",
      body: new Uint8Array([9]),
    });
    const loaded = await storage.getObject({ workspaceId: "ws_1", key: "ws_1/avatar/a.png" });
    await storage.deleteObject({ workspaceId: "ws_1", key: "ws_1/avatar/a.png" });

    expect(loaded?.body).toEqual(new Uint8Array([1, 2]));
    expect(storage.getPublicUrl({ workspaceId: "ws_1", key: "ws_1/avatar/a.png" })).toBe(
      "https://cdn.example.test/ws_1/avatar/a.png",
    );
    expect(calls).toEqual([
      "put:kit-bucket:ws_1/avatar/a.png:image/png",
      "get:ws_1/avatar/a.png",
      "delete:ws_1/avatar/a.png",
    ]);
  });
});
