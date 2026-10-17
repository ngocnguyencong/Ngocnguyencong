import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { beforeAll, describe, expect, it } from "vitest";

import { workspace } from "./schema.js";
import type { PostgresDatabaseLifecycle } from "./postgres.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integrationDescribe = testDatabaseUrl ? describe : describe.skip;
const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "drizzle");

async function createWorkspace(
  lifecycle: PostgresDatabaseLifecycle,
  suffix: string,
): Promise<string> {
  const id = `ws_test_${suffix}`;
  await lifecycle.database.insert(workspace).values({
    id,
    name: "Usage Counter Test",
    slug: `usage-counter-${suffix}`,
  });
  return id;
}

const SEPTEMBER = new Date("2026-09-01T00:00:00.000Z");
const OCTOBER = new Date("2026-10-01T00:00:00.000Z");

integrationDescribe("usage counter repository", () => {
  beforeAll(async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });

    try {
      await migrate(lifecycle.database, { migrationsFolder });
    } finally {
      await lifecycle.close();
    }
  });

  it("consumes up to the limit, then rejects without touching the counter", async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const { createDrizzleUsageCounterRepository } = await import("./" + "usage-counters.js");
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const suffix = randomUUID().replaceAll("-", "");
    let workspaceId = "";

    try {
      workspaceId = await createWorkspace(lifecycle, suffix);
      const repository = createDrizzleUsageCounterRepository(lifecycle.database);
      const counter = { key: "ai.requests", periodStart: SEPTEMBER, workspaceId };

      for (let i = 1; i <= 5; i += 1) {
        await expect(repository.consume({ ...counter, limit: 5, n: 1 })).resolves.toEqual({
          ok: true,
          used: i,
          limit: 5,
        });
      }

      // One over the limit fails; the stored counter stays at the limit.
      await expect(repository.consume({ ...counter, limit: 5, n: 1 })).resolves.toEqual({
        ok: false,
        reason: "quota_exhausted",
        used: 5,
        limit: 5,
      });
      await expect(repository.consume({ ...counter, limit: 5, n: 3 })).resolves.toEqual({
        ok: false,
        reason: "quota_exhausted",
        used: 5,
        limit: 5,
      });
      await expect(repository.get(counter)).resolves.toEqual({ used: 5 });

      // A larger single consume can still fit under the cap mid-flight.
      await expect(repository.consume({ ...counter, limit: 8, n: 3 })).resolves.toEqual({
        ok: true,
        used: 8,
        limit: 8,
      });
    } finally {
      if (workspaceId !== "") {
        await lifecycle.database.delete(workspace).where(eq(workspace.id, workspaceId));
      }
      await lifecycle.close();
    }
  });

  it("treats a null limit as unlimited and never creates a row for a consume over the limit", async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const { createDrizzleUsageCounterRepository } = await import("./" + "usage-counters.js");
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const suffix = randomUUID().replaceAll("-", "");
    let workspaceId = "";

    try {
      workspaceId = await createWorkspace(lifecycle, suffix);
      const repository = createDrizzleUsageCounterRepository(lifecycle.database);

      await expect(
        repository.consume({
          key: "exports",
          limit: null,
          n: 50_000,
          periodStart: SEPTEMBER,
          workspaceId,
        }),
      ).resolves.toEqual({ ok: true, used: 50_000, limit: null });
      await expect(
        repository.consume({
          key: "exports",
          limit: null,
          n: 50_000,
          periodStart: SEPTEMBER,
          workspaceId,
        }),
      ).resolves.toEqual({ ok: true, used: 100_000, limit: null });

      // n > limit on a fresh counter must fail without inserting a row —
      // the INSERT branch has no quota guard of its own.
      await expect(
        repository.consume({
          key: "never-allowed",
          limit: 5,
          n: 10,
          periodStart: SEPTEMBER,
          workspaceId,
        }),
      ).resolves.toEqual({ ok: false, reason: "quota_exhausted", used: 0, limit: 5 });
      await expect(
        repository.get({ key: "never-allowed", periodStart: SEPTEMBER, workspaceId }),
      ).resolves.toEqual({ used: 0 });
      expect(
        (await repository.list(workspaceId)).filter((row) => row.key === "never-allowed"),
      ).toHaveLength(0);
    } finally {
      if (workspaceId !== "") {
        await lifecycle.database.delete(workspace).where(eq(workspace.id, workspaceId));
      }
      await lifecycle.close();
    }
  });

  it("keeps keys and periods independent — rollover writes a fresh row", async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const { createDrizzleUsageCounterRepository } = await import("./" + "usage-counters.js");
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const suffix = randomUUID().replaceAll("-", "");
    let workspaceId = "";

    try {
      workspaceId = await createWorkspace(lifecycle, suffix);
      const repository = createDrizzleUsageCounterRepository(lifecycle.database);

      await repository.consume({ key: "a", limit: 1, n: 1, periodStart: SEPTEMBER, workspaceId });
      // Same period, different key — independent counter.
      await expect(
        repository.consume({ key: "b", limit: 1, n: 1, periodStart: SEPTEMBER, workspaceId }),
      ).resolves.toEqual({ ok: true, used: 1, limit: 1 });
      // Same key, next period — the old row is untouched.
      await expect(
        repository.consume({ key: "a", limit: 1, n: 1, periodStart: OCTOBER, workspaceId }),
      ).resolves.toEqual({ ok: true, used: 1, limit: 1 });

      const all = await repository.list(workspaceId);
      expect(all).toHaveLength(3);

      const september = await repository.list(workspaceId, { periodStart: SEPTEMBER });
      expect(september.map((row) => row.key)).toEqual(["a", "b"]);
      await expect(
        repository.get({ key: "a", periodStart: SEPTEMBER, workspaceId }),
      ).resolves.toEqual({ used: 1 });
      // …and September's key "a" is still exhausted even though October reset.
      await expect(
        repository.consume({ key: "a", limit: 1, n: 1, periodStart: SEPTEMBER, workspaceId }),
      ).resolves.toEqual({ ok: false, reason: "quota_exhausted", used: 1, limit: 1 });
    } finally {
      if (workspaceId !== "") {
        await lifecycle.database.delete(workspace).where(eq(workspace.id, workspaceId));
      }
      await lifecycle.close();
    }
  });

  it("serializes concurrent consumes on the row lock — exactly `limit` succeed", async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const { createDrizzleUsageCounterRepository } = await import("./" + "usage-counters.js");
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const suffix = randomUUID().replaceAll("-", "");
    let workspaceId = "";

    try {
      workspaceId = await createWorkspace(lifecycle, suffix);
      const repository = createDrizzleUsageCounterRepository(lifecycle.database);
      const counter = { key: "concurrent", limit: 5, n: 1, periodStart: SEPTEMBER, workspaceId };

      // Ten racing consumers against a limit of five: the conditional
      // DO UPDATE holds the row lock, so exactly five may pass the guard.
      const results = await Promise.all(
        Array.from({ length: 10 }, () => repository.consume(counter)),
      );
      expect(results.filter((result) => result.ok)).toHaveLength(5);
      expect(results.filter((result) => !result.ok)).toHaveLength(5);
      for (const rejected of results.filter((result) => !result.ok)) {
        expect(rejected).toMatchObject({ reason: "quota_exhausted", limit: 5 });
      }

      await expect(
        repository.get({ key: "concurrent", periodStart: SEPTEMBER, workspaceId }),
      ).resolves.toEqual({ used: 5 });
    } finally {
      if (workspaceId !== "") {
        await lifecycle.database.delete(workspace).where(eq(workspace.id, workspaceId));
      }
      await lifecycle.close();
    }
  });

  it("scopes counters per workspace — same key and period stay separate", async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const { createDrizzleUsageCounterRepository } = await import("./" + "usage-counters.js");
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const suffix = randomUUID().replaceAll("-", "");
    let workspaceId = "";
    let otherWorkspaceId = "";

    try {
      workspaceId = await createWorkspace(lifecycle, suffix);
      otherWorkspaceId = await createWorkspace(lifecycle, `${suffix}_b`);
      const repository = createDrizzleUsageCounterRepository(lifecycle.database);

      await repository.consume({ key: "a", limit: 1, n: 1, periodStart: SEPTEMBER, workspaceId });
      await expect(
        repository.consume({
          key: "a",
          limit: 1,
          n: 1,
          periodStart: SEPTEMBER,
          workspaceId: otherWorkspaceId,
        }),
      ).resolves.toEqual({ ok: true, used: 1, limit: 1 });
      await expect(
        repository.get({ key: "a", periodStart: SEPTEMBER, workspaceId: otherWorkspaceId }),
      ).resolves.toEqual({ used: 1 });
      // list() never crosses the workspace boundary.
      expect((await repository.list(workspaceId)).map((row) => row.key)).toEqual(["a"]);
      expect(await repository.list(otherWorkspaceId)).toHaveLength(1);
    } finally {
      for (const id of [workspaceId, otherWorkspaceId]) {
        if (id !== "") {
          await lifecycle.database.delete(workspace).where(eq(workspace.id, id));
        }
      }
      await lifecycle.close();
    }
  });
});
