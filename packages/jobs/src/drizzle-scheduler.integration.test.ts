import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/postgres-js/migrator";
import { eq, inArray } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { jobSchedule, workspace } from "@supastack/db";
import type { PostgresDatabaseLifecycle } from "@supastack/db";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integrationDescribe = testDatabaseUrl ? describe : describe.skip;
const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "db", "drizzle");
const HOUR_MS = 60 * 60_000;

async function createWorkspace(
  lifecycle: PostgresDatabaseLifecycle,
  suffix: string,
): Promise<string> {
  const id = `ws_test_${suffix}`;
  await lifecycle.database.insert(workspace).values({
    id,
    name: "Scheduler Test",
    slug: `scheduler-${suffix}`,
  });
  return id;
}

integrationDescribe("drizzle job scheduler", () => {
  beforeAll(async () => {
    const { createPostgresDatabase } = await import("@supastack/db");
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    try {
      await migrate(lifecycle.database, { migrationsFolder });
      // Deterministic claim isolation: claims are GLOBAL and LIMIT-bounded,
      // so stale due rows from earlier runs would starve this file's rows.
      await lifecycle.database.delete(jobSchedule);
    } finally {
      await lifecycle.close();
    }
  });

  it("claims a due schedule once: stamps lastRunAt and advances nextRunAt", async () => {
    const { createPostgresDatabase } = await import("@supastack/db");
    const { createDrizzleJobScheduler } = await import("./" + "drizzle-scheduler.js");
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const suffix = randomUUID().replaceAll("-", "");

    try {
      const workspaceId = await createWorkspace(lifecycle, suffix);
      const scheduler = createDrizzleJobScheduler(lifecycle.database);
      const schedule = await scheduler.upsertSchedule({
        cron: "0 * * * *",
        input: { kind: "digest" },
        type: `test.${suffix.slice(0, 8)}`,
        workspaceId,
      });

      const now = new Date();
      // Force the row due without waiting for the computed next hour.
      await lifecycle.database
        .update(jobSchedule)
        .set({ nextRunAt: new Date(now.getTime() - 60_000) })
        .where(eq(jobSchedule.id, schedule.id));

      const claimed = await scheduler.claimDueSchedules({ limit: 10, now });
      const mine = claimed.filter((row) => row.id === schedule.id);
      expect(mine).toHaveLength(1);
      expect(mine[0]!.lastRunAt).toEqual(now);
      expect(mine[0]!.nextRunAt!.getTime()).toBeGreaterThan(now.getTime());
      expect(mine[0]!.input).toEqual({ kind: "digest" });

      // The advance makes the same tick see nothing more to claim.
      const again = await scheduler.claimDueSchedules({ limit: 10, now });
      expect(again.filter((row) => row.id === schedule.id)).toHaveLength(0);
    } finally {
      await lifecycle.close();
    }
  });

  it("records elapsed occurrences as missed runs — cumulative, durable, dry-run-safe", async () => {
    const { createPostgresDatabase } = await import("@supastack/db");
    const { createDrizzleJobScheduler } = await import("./" + "drizzle-scheduler.js");
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const suffix = randomUUID().replaceAll("-", "");

    try {
      const workspaceId = await createWorkspace(lifecycle, suffix);
      const otherWorkspaceId = await createWorkspace(lifecycle, `${suffix}_b`);
      const scheduler = createDrizzleJobScheduler(lifecycle.database);
      const schedule = await scheduler.upsertSchedule({
        cron: "0 * * * *",
        input: null,
        type: `missed.${suffix.slice(0, 8)}`,
        workspaceId,
      });
      const isolated = await scheduler.upsertSchedule({
        cron: "0 * * * *",
        input: null,
        type: `missed.other.${suffix.slice(0, 6)}`,
        workspaceId: otherWorkspaceId,
      });
      expect(schedule.missedRuns).toBe(0);

      // Hour-aligned tick; force the row four occurrences behind. The
      // stored occurrence still claims once — the four elapsed ones count.
      const now = new Date(Math.floor(Date.now() / HOUR_MS) * HOUR_MS);
      await lifecycle.database
        .update(jobSchedule)
        .set({ nextRunAt: new Date(now.getTime() - 4 * HOUR_MS) })
        .where(eq(jobSchedule.id, schedule.id));

      const first = await scheduler.claimDueSchedules({ limit: 10, now });
      const mine = first.filter((row) => row.id === schedule.id);
      expect(mine).toHaveLength(1);
      expect(mine[0]!.missedDelta).toBe(4);
      expect(mine[0]!.missedRuns).toBe(4);

      const [persisted] = await lifecycle.database
        .select({ missedRuns: jobSchedule.missedRuns })
        .from(jobSchedule)
        .where(eq(jobSchedule.id, schedule.id));
      expect(persisted!.missedRuns).toBe(4);

      // A second late claim accumulates on top of the stored total.
      await lifecycle.database
        .update(jobSchedule)
        .set({ nextRunAt: new Date(now.getTime() - 2 * HOUR_MS) })
        .where(eq(jobSchedule.id, schedule.id));
      const second = await scheduler.claimDueSchedules({ limit: 10, now });
      expect(second.filter((row) => row.id === schedule.id)[0]!.missedDelta).toBe(2);
      expect(second.filter((row) => row.id === schedule.id)[0]!.missedRuns).toBe(6);

      // dryRun projects the same numbers but never writes.
      await lifecycle.database
        .update(jobSchedule)
        .set({ nextRunAt: new Date(now.getTime() - HOUR_MS) })
        .where(eq(jobSchedule.id, schedule.id));
      const preview = await scheduler.claimDueSchedules({ dryRun: true, limit: 10, now });
      expect(preview.filter((row) => row.id === schedule.id)[0]!.missedDelta).toBe(1);
      expect(preview.filter((row) => row.id === schedule.id)[0]!.missedRuns).toBe(7);
      const [unchanged] = await lifecycle.database
        .select({ missedRuns: jobSchedule.missedRuns })
        .from(jobSchedule)
        .where(eq(jobSchedule.id, schedule.id));
      expect(unchanged!.missedRuns).toBe(6);

      // The neighboring workspace's schedule was never forced due — its
      // counter stays at zero throughout.
      const [neighbor] = await lifecycle.database
        .select({ missedRuns: jobSchedule.missedRuns })
        .from(jobSchedule)
        .where(eq(jobSchedule.id, isolated.id));
      expect(neighbor!.missedRuns).toBe(0);
    } finally {
      await lifecycle.close();
    }
  });

  it("never claims disabled or not-yet-due schedules", async () => {
    const { createPostgresDatabase } = await import("@supastack/db");
    const { createDrizzleJobScheduler } = await import("./" + "drizzle-scheduler.js");
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const suffix = randomUUID().replaceAll("-", "");

    try {
      const workspaceId = await createWorkspace(lifecycle, suffix);
      const scheduler = createDrizzleJobScheduler(lifecycle.database);
      const disabled = await scheduler.upsertSchedule({
        cron: "0 * * * *",
        enabled: false,
        input: null,
        type: `disabled.${suffix.slice(0, 8)}`,
        workspaceId,
      });
      const future = await scheduler.upsertSchedule({
        cron: "0 0 1 1 *",
        input: null,
        type: `future.${suffix.slice(0, 8)}`,
        workspaceId,
      });

      const past = new Date(Date.now() - 60_000);
      await lifecycle.database
        .update(jobSchedule)
        .set({ nextRunAt: past })
        .where(eq(jobSchedule.id, disabled.id));
      // `future` keeps its computed far-future nextRunAt.

      const claimed = await scheduler.claimDueSchedules({ limit: 100, now: new Date() });
      const ids = claimed.map((row) => row.id);
      expect(ids).not.toContain(disabled.id);
      expect(ids).not.toContain(future.id);
    } finally {
      await lifecycle.close();
    }
  });

  it("claims platform schedules (NULL workspace_id) alongside workspace rows", async () => {
    const { createPostgresDatabase } = await import("@supastack/db");
    const { createDrizzleJobScheduler } = await import("./" + "drizzle-scheduler.js");
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const suffix = randomUUID().replaceAll("-", "");

    try {
      const scheduler = createDrizzleJobScheduler(lifecycle.database);
      const schedule = await scheduler.upsertSchedule({
        cron: "* * * * *",
        id: `platform:test.${suffix.slice(0, 8)}`,
        input: {},
        type: "test.platform",
        workspaceId: null,
      });
      expect(schedule.workspaceId).toBeNull();

      // Idempotent: the same deterministic id upserts in place.
      const again = await scheduler.upsertSchedule({
        cron: "*/5 * * * *",
        id: schedule.id,
        input: {},
        type: "test.platform",
        workspaceId: null,
      });
      expect(again.id).toBe(schedule.id);

      const now = new Date();
      await lifecycle.database
        .update(jobSchedule)
        .set({ nextRunAt: new Date(now.getTime() - 60_000) })
        .where(eq(jobSchedule.id, schedule.id));

      const claimed = await scheduler.claimDueSchedules({ limit: 100, now });
      expect(claimed.map((row) => row.id)).toContain(schedule.id);

      // Platform rows never appear in a workspace listing.
      const workspaceId = await createWorkspace(lifecycle, `${suffix}_ws`);
      expect(await scheduler.listSchedules(workspaceId)).toHaveLength(0);
    } finally {
      await lifecycle.close();
    }
  });

  it("never double-claims under two concurrent ticks (FOR UPDATE SKIP LOCKED)", async () => {
    const { createPostgresDatabase } = await import("@supastack/db");
    const { createDrizzleJobScheduler } = await import("./" + "drizzle-scheduler.js");
    const lifecycle = createPostgresDatabase({
      databaseUrl: testDatabaseUrl!,
      maxConnections: 4,
    });
    const suffix = randomUUID().replaceAll("-", "");

    try {
      const workspaceId = await createWorkspace(lifecycle, suffix);
      const scheduler = createDrizzleJobScheduler(lifecycle.database);
      const ids: string[] = [];
      for (let i = 0; i < 4; i += 1) {
        const schedule = await scheduler.upsertSchedule({
          cron: "0 * * * *",
          input: null,
          type: `race.${suffix.slice(0, 6)}.${i}`,
          workspaceId,
        });
        ids.push(schedule.id);
      }
      const now = new Date();
      await lifecycle.database
        .update(jobSchedule)
        .set({ nextRunAt: new Date(now.getTime() - 60_000) })
        .where(inArray(jobSchedule.id, ids));

      const [a, b] = await Promise.all([
        scheduler.claimDueSchedules({ limit: 4, now }),
        scheduler.claimDueSchedules({ limit: 4, now }),
      ]);

      const claimedIds = [...a, ...b].map((row) => row.id);
      expect(new Set(claimedIds).size).toBe(claimedIds.length);
      // Every claimed row is one of ours (other test runs' rows are ignored
      // by filtering, but ours must each be claimed at most once).
      for (const id of claimedIds.filter((id) => ids.includes(id))) {
        expect(ids).toContain(id);
      }
    } finally {
      await lifecycle.close();
    }
  });

  it("removes schedules scoped to their workspace", async () => {
    const { createPostgresDatabase } = await import("@supastack/db");
    const { createDrizzleJobScheduler, ScheduleNotFoundError } = await import(
      "./" + "drizzle-scheduler.js"
    );
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const suffix = randomUUID().replaceAll("-", "");

    try {
      const workspaceId = await createWorkspace(lifecycle, suffix);
      const scheduler = createDrizzleJobScheduler(lifecycle.database);
      const schedule = await scheduler.upsertSchedule({
        cron: "0 * * * *",
        input: null,
        type: `remove.${suffix.slice(0, 8)}`,
        workspaceId,
      });

      await scheduler.removeSchedule({ scheduleId: schedule.id, workspaceId });
      await expect(
        scheduler.removeSchedule({ scheduleId: schedule.id, workspaceId }),
      ).rejects.toThrow(ScheduleNotFoundError);
    } finally {
      await lifecycle.close();
    }
  });
});
