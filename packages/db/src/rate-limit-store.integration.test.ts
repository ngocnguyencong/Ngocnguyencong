import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { beforeAll, describe, expect, it } from "vitest";

import { rateLimitBucket } from "./schema.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integrationDescribe = testDatabaseUrl ? describe : describe.skip;
const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "drizzle");

integrationDescribe("Postgres rate-limit store", () => {
  beforeAll(async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });

    try {
      await migrate(lifecycle.database, { migrationsFolder });
    } finally {
      await lifecycle.close();
    }
  });

  it("increments within the window, then rolls over after expiry", async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const { createPostgresRateLimitStore } = await import("./" + "rate-limit-store.js");
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const suffix = randomUUID().replaceAll("-", "");
    const key = `test_rate_limit_${suffix}`;
    const now = new Date("2026-09-05T12:00:00.000Z");
    const expires = new Date(now.getTime() + 60_000);

    try {
      const store = createPostgresRateLimitStore(lifecycle.database);

      await expect(store.hit(key, 60_000, now)).resolves.toEqual({
        count: 1,
        expiresAt: expires,
      });
      await expect(store.hit(key, 60_000, now)).resolves.toEqual({
        count: 2,
        expiresAt: expires,
      });
      await expect(store.hit(key, 60_000, now)).resolves.toEqual({
        count: 3,
        expiresAt: expires,
      });

      const rolled = new Date(now.getTime() + 60_001);
      await expect(store.hit(key, 60_000, rolled)).resolves.toEqual({
        count: 1,
        expiresAt: new Date(rolled.getTime() + 60_000),
      });

      const [row] = await lifecycle.database
        .select({ windowStart: rateLimitBucket.windowStart })
        .from(rateLimitBucket)
        .where(eq(rateLimitBucket.key, key));
      expect(row?.windowStart).toEqual(rolled);
    } finally {
      await lifecycle.database.delete(rateLimitBucket).where(eq(rateLimitBucket.key, key));
      await lifecycle.close();
    }
  });

  it("serializes concurrent hits so every caller sees a unique count", async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const { createPostgresRateLimitStore } = await import("./" + "rate-limit-store.js");
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl!, maxConnections: 10 });
    const suffix = randomUUID().replaceAll("-", "");
    const key = `test_rate_limit_concurrent_${suffix}`;
    const now = new Date("2026-09-05T13:00:00.000Z");

    try {
      const store = createPostgresRateLimitStore(lifecycle.database);
      const hits = await Promise.all(Array.from({ length: 20 }, () => store.hit(key, 60_000, now)));

      expect(hits.map((hit) => hit.count).sort((a, b) => a - b)).toEqual(
        Array.from({ length: 20 }, (_value, index) => index + 1),
      );
    } finally {
      await lifecycle.database.delete(rateLimitBucket).where(eq(rateLimitBucket.key, key));
      await lifecycle.close();
    }
  });

  it("prunes only expired buckets and reports the deleted count", async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const { createPostgresRateLimitStore, pruneExpiredRateLimitBuckets } = await import(
      "./" + "rate-limit-store.js"
    );
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const suffix = randomUUID().replaceAll("-", "");
    const expiredKey = `test_rate_limit_expired_${suffix}`;
    const liveKey = `test_rate_limit_live_${suffix}`;
    const now = new Date("2026-09-05T14:00:00.000Z");

    try {
      const store = createPostgresRateLimitStore(lifecycle.database);
      await store.hit(expiredKey, 60_000, new Date(now.getTime() - 120_000));
      await store.hit(liveKey, 60_000, now);

      await expect(pruneExpiredRateLimitBuckets(lifecycle.database, now)).resolves.toBe(1);

      const remaining = await lifecycle.database
        .select({ key: rateLimitBucket.key })
        .from(rateLimitBucket);
      expect(remaining.some((row) => row.key === expiredKey)).toBe(false);
      expect(remaining.some((row) => row.key === liveKey)).toBe(true);
    } finally {
      await lifecycle.database.delete(rateLimitBucket).where(eq(rateLimitBucket.key, liveKey));
      await lifecycle.close();
    }
  });
});
