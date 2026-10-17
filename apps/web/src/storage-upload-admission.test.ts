import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  calls: [] as Array<{ name: string; key: string }>,
  specs: [] as Array<{ name: string; limit: number; windowMs: number; options: unknown }>,
  decisions: {
    "storage-image-user": { allowed: true, retryAfterSeconds: 0 },
    "storage-image-workspace": { allowed: true, retryAfterSeconds: 0 },
    "storage-image-global": { allowed: true, retryAfterSeconds: 0 },
  } as Record<string, { allowed: boolean; retryAfterSeconds: number }>,
}));

vi.mock("./rate-limit-runtime", () => ({
  createNamedRateLimiter: (name: string, limit: number, windowMs: number, options: unknown) => {
    mocks.specs.push({ name, limit, windowMs, options });
    return {
      check: async (key: string) => {
        mocks.calls.push({ name, key });
        return { ...mocks.decisions[name]! };
      },
    };
  },
}));

import { checkStorageImageUploadAdmission } from "./storage-upload-admission";

afterEach(() => {
  mocks.calls.length = 0;
  for (const name of Object.keys(mocks.decisions)) {
    mocks.decisions[name] = { allowed: true, retryAfterSeconds: 0 };
  }
});

describe("checkStorageImageUploadAdmission", () => {
  it("creates fail-closed bounded user, workspace, and global buckets", () => {
    expect(mocks.specs).toEqual([
      { name: "storage-image-user", limit: 10, windowMs: 60_000, options: { failClosed: true } },
      {
        name: "storage-image-workspace",
        limit: 30,
        windowMs: 60_000,
        options: { failClosed: true },
      },
      {
        name: "storage-image-global",
        limit: 120,
        windowMs: 60_000,
        options: { failClosed: true },
      },
    ]);
  });

  it("requires all buckets and keys the first two from authenticated scope", async () => {
    await expect(
      checkStorageImageUploadAdmission({ workspaceId: "ws_1", userId: "user_1" }),
    ).resolves.toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(mocks.calls).toEqual([
      { name: "storage-image-user", key: "workspace:ws_1:user:user_1" },
      { name: "storage-image-workspace", key: "workspace:ws_1" },
      { name: "storage-image-global", key: "all" },
    ]);
  });

  it("rejects if any bucket denies and returns the longest retry delay", async () => {
    mocks.decisions["storage-image-workspace"] = { allowed: false, retryAfterSeconds: 17 };
    mocks.decisions["storage-image-global"] = { allowed: false, retryAfterSeconds: 31 };

    await expect(
      checkStorageImageUploadAdmission({ workspaceId: "ws_1", userId: "user_1" }),
    ).resolves.toEqual({ allowed: false, retryAfterSeconds: 31 });
  });
});
