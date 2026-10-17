import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { beforeAll, describe, expect, it } from "vitest";

import { platformAiSpend } from "./schema.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integrationDescribe = testDatabaseUrl ? describe : describe.skip;
const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "drizzle");

integrationDescribe("platform AI spend", () => {
  beforeAll(async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });

    try {
      await migrate(lifecycle.database, { migrationsFolder });
    } finally {
      await lifecycle.close();
    }
  });

  it("reserves atomically up to the limit and rejects the overage", async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const { reservePlatformAiSpend } = await import("./" + "platform-ai-spend.js");
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const day = "2099-01-15";

    try {
      await lifecycle.database.delete(platformAiSpend).where(eq(platformAiSpend.day, day));

      const results: boolean[] = [];
      for (let index = 0; index < 4; index += 1) {
        results.push(
          await reservePlatformAiSpend(lifecycle.database, {
            amount: 300n,
            day,
            limit: 1_000n,
          }),
        );
      }
      expect(results).toEqual([true, true, true, false]);

      const [row] = await lifecycle.database
        .select({ spent: platformAiSpend.spentMicrounits })
        .from(platformAiSpend)
        .where(eq(platformAiSpend.day, day));
      expect(row?.spent).toBe(900n);
    } finally {
      await lifecycle.database.delete(platformAiSpend).where(eq(platformAiSpend.day, day));
      await lifecycle.close();
    }
  });

  it("rejects a single reserve larger than the limit without writing", async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const { reservePlatformAiSpend } = await import("./" + "platform-ai-spend.js");
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const day = "2099-02-15";

    try {
      await lifecycle.database.delete(platformAiSpend).where(eq(platformAiSpend.day, day));

      await expect(
        reservePlatformAiSpend(lifecycle.database, { amount: 1_001n, day, limit: 1_000n }),
      ).resolves.toBe(false);

      const rows = await lifecycle.database
        .select({ day: platformAiSpend.day })
        .from(platformAiSpend)
        .where(eq(platformAiSpend.day, day));
      expect(rows).toEqual([]);
    } finally {
      await lifecycle.close();
    }
  });

  it("serializes concurrent reserves so the limit is never exceeded", async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const { reservePlatformAiSpend } = await import("./" + "platform-ai-spend.js");
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl!, maxConnections: 10 });
    const day = "2099-03-15";

    try {
      await lifecycle.database.delete(platformAiSpend).where(eq(platformAiSpend.day, day));

      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          reservePlatformAiSpend(lifecycle.database, {
            amount: 150n,
            day,
            limit: 1_000n,
          }),
        ),
      );
      expect(results.filter(Boolean)).toHaveLength(6);

      const [row] = await lifecycle.database
        .select({ spent: platformAiSpend.spentMicrounits })
        .from(platformAiSpend)
        .where(eq(platformAiSpend.day, day));
      expect(row?.spent).toBe(900n);
    } finally {
      await lifecycle.database.delete(platformAiSpend).where(eq(platformAiSpend.day, day));
      await lifecycle.close();
    }
  });

  it("releases reservations without dropping below zero", async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const { releasePlatformAiSpend, reservePlatformAiSpend } = await import(
      "./" + "platform-ai-spend.js"
    );
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const day = "2099-04-15";

    try {
      await lifecycle.database.delete(platformAiSpend).where(eq(platformAiSpend.day, day));
      await reservePlatformAiSpend(lifecycle.database, { amount: 500n, day, limit: 1_000n });

      await releasePlatformAiSpend(lifecycle.database, { amount: 200n, day });
      let [row] = await lifecycle.database
        .select({ spent: platformAiSpend.spentMicrounits })
        .from(platformAiSpend)
        .where(eq(platformAiSpend.day, day));
      expect(row?.spent).toBe(300n);

      await releasePlatformAiSpend(lifecycle.database, { amount: 999n, day });
      [row] = await lifecycle.database
        .select({ spent: platformAiSpend.spentMicrounits })
        .from(platformAiSpend)
        .where(eq(platformAiSpend.day, day));
      expect(row?.spent).toBe(0n);
    } finally {
      await lifecycle.database.delete(platformAiSpend).where(eq(platformAiSpend.day, day));
      await lifecycle.close();
    }
  });

  it("settles to actual spend in both directions", async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const { reservePlatformAiSpend, settlePlatformAiSpend } = await import(
      "./" + "platform-ai-spend.js"
    );
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const day = "2099-05-15";

    try {
      await lifecycle.database.delete(platformAiSpend).where(eq(platformAiSpend.day, day));
      await reservePlatformAiSpend(lifecycle.database, { amount: 300n, day, limit: 1_000n });

      await settlePlatformAiSpend(lifecycle.database, { actual: 120n, day, reserved: 300n });
      let [row] = await lifecycle.database
        .select({ spent: platformAiSpend.spentMicrounits })
        .from(platformAiSpend)
        .where(eq(platformAiSpend.day, day));
      expect(row?.spent).toBe(120n);

      // Actual spend is truth and may exceed the configured limit.
      await settlePlatformAiSpend(lifecycle.database, { actual: 5_000n, day, reserved: 300n });
      [row] = await lifecycle.database
        .select({ spent: platformAiSpend.spentMicrounits })
        .from(platformAiSpend)
        .where(eq(platformAiSpend.day, day));
      expect(row?.spent).toBe(4_820n);
    } finally {
      await lifecycle.database.delete(platformAiSpend).where(eq(platformAiSpend.day, day));
      await lifecycle.close();
    }
  });
});
