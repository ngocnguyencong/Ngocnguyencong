import { getTableColumns, getTableName, type SQL } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { jobSchedule } from "@supastack/db";

import {
  createDrizzleJobScheduler,
  MAX_CLAIM_LIMIT,
  MAX_WORKSPACE_SCHEDULES,
  ScheduleNotFoundError,
  WORKSPACE_CLAIM_LIMIT,
  WorkspaceScheduleLimitError,
} from "./drizzle-scheduler";

const CRON = "0 * * * *";
const NOW = new Date("2026-03-04T09:00:00.000Z");

const DUE_ROW = {
  id: "sch_due",
  workspace_id: "ws_1",
  type: "email.digest",
  cron: "0 * * * *",
  input: null,
  enabled: true,
  last_run_at: null,
  next_run_at: new Date("2026-03-04T08:00:00.000Z"),
  missed_runs: 2,
  created_at: new Date("2026-03-01T00:00:00.000Z"),
  updated_at: new Date("2026-03-01T00:00:00.000Z"),
};

describe("job_schedule schema", () => {
  it("allows NULL workspace_id for platform-level schedules", () => {
    expect(getTableName(jobSchedule)).toBe("job_schedule");
    const columns = getTableColumns(jobSchedule);
    expect(columns.workspaceId.notNull).toBe(false);
    const config = getTableConfig(jobSchedule);
    expect(config.indexes.map((index) => index.config.name)).toContain(
      "idx_job_schedule_workspace",
    );
  });

  it("carries the partial unique (workspace,type) and enabled claim indexes", () => {
    const config = getTableConfig(jobSchedule);
    const names = config.indexes.map((index) => index.config.name);
    expect(names).toContain("idx_job_schedule_workspace_type");
    expect(names).toContain("idx_job_schedule_next_run_at");
    const uniquePair = config.indexes.find(
      (index) => index.config.name === "idx_job_schedule_workspace_type",
    )!;
    expect(uniquePair.config.unique).toBe(true);
    expect(uniquePair.config.where).toBeDefined();
    const hotClaim = config.indexes.find(
      (index) => index.config.name === "idx_job_schedule_next_run_at",
    )!;
    expect(hotClaim.config.where).toBeDefined();
  });
});

/**
 * Records every drizzle call the scheduler makes — query-builder chains land in
 * `calls` and raw `execute` statements are rendered through PgDialect so tests
 * can assert on the emitted SQL without a database.
 */
function createCapturingDatabase() {
  const dialect = new PgDialect();
  const calls: {
    deleteWheres: unknown[];
    dueRows: Record<string, unknown>[];
    executeParams: unknown[][];
    executeSql: string[];
    insertValues: Record<string, unknown>[];
    onConflict: {
      set: Record<string, unknown>;
      setWhere?: unknown;
      target?: unknown;
      targetWhere?: unknown;
    }[];
    selectRows: Record<string, unknown>[];
    returningRows: Record<string, unknown>[];
    quotaRows: Record<string, unknown>[];
    updateSets: Record<string, unknown>[];
    updateWheres: unknown[];
  } = {
    deleteWheres: [],
    dueRows: [],
    executeParams: [],
    executeSql: [],
    insertValues: [],
    onConflict: [],
    selectRows: [],
    returningRows: [],
    quotaRows: [{ schedule_count: 0, already_exists: false }],
    updateSets: [],
    updateWheres: [],
  };

  const tx = {
    async execute(command: SQL) {
      const rendered = dialect.sqlToQuery(command);
      calls.executeSql.push(rendered.sql);
      calls.executeParams.push(rendered.params);
      const normalizedSql = rendered.sql.trimStart().toLowerCase();
      if (normalizedSql.includes("count(*)")) {
        return calls.quotaRows;
      }
      if (normalizedSql.startsWith("select") || normalizedSql.startsWith("with")) {
        return calls.dueRows;
      }
      return [];
    },
  };

  const database = {
    delete() {
      return {
        where(condition: unknown) {
          calls.deleteWheres.push(condition);
          return {
            async returning() {
              return calls.returningRows;
            },
          };
        },
      };
    },
    insert() {
      return {
        values(value: Record<string, unknown>) {
          calls.insertValues.push(value);
          return {
            onConflictDoUpdate(config: { set: Record<string, unknown>; setWhere?: unknown }) {
              calls.onConflict.push(config);
              return {
                async returning() {
                  return calls.returningRows;
                },
              };
            },
            async returning() {
              return calls.returningRows;
            },
          };
        },
      };
    },
    select() {
      return {
        from() {
          return {
            where() {
              return {
                async limit() {
                  return calls.selectRows;
                },
                async orderBy() {
                  return calls.selectRows;
                },
              };
            },
          };
        },
      };
    },
    async transaction(fn: (tx: unknown) => Promise<unknown>) {
      return fn({ ...database, execute: tx.execute });
    },
    update() {
      return {
        set(value: Record<string, unknown>) {
          calls.updateSets.push(value);
          return {
            where(condition: unknown) {
              calls.updateWheres.push(condition);
              return {
                async returning() {
                  return calls.returningRows;
                },
              };
            },
          };
        },
      };
    },
  };

  return { calls, database: database as never };
}

describe("createDrizzleJobScheduler validation", () => {
  it("rejects invalid upsert input before touching the database", async () => {
    const scheduler = createDrizzleJobScheduler(null as never);

    await expect(
      scheduler.upsertSchedule({ cron: "not a cron", type: "x", workspaceId: "ws_1" }),
    ).rejects.toThrow("cron");
    await expect(
      scheduler.upsertSchedule({ cron: CRON, type: "", workspaceId: "ws_1" }),
    ).rejects.toThrow();
    await expect(
      scheduler.upsertSchedule({ cron: CRON, type: "   ", workspaceId: "ws_1" }),
    ).rejects.toThrow();
    await expect(
      scheduler.upsertSchedule({ cron: CRON, type: "x".repeat(65), workspaceId: "ws_1" }),
    ).rejects.toThrow();
    await expect(
      scheduler.upsertSchedule({ cron: CRON, type: "bad type!", workspaceId: "ws_1" }),
    ).rejects.toThrow();
    await expect(
      scheduler.upsertSchedule({ cron: CRON, type: "x", workspaceId: "" }),
    ).rejects.toThrow();
    await expect(
      scheduler.upsertSchedule({ cron: CRON, type: "x", workspaceId: "   " }),
    ).rejects.toThrow();
    await expect(
      scheduler.upsertSchedule({ cron: CRON, id: "", type: "x", workspaceId: "ws_1" }),
    ).rejects.toThrow();
    await expect(scheduler.upsertSchedule(null as never)).rejects.toThrow();
  });

  it("rejects sub-hour workspace crons before touching the database", async () => {
    const { calls, database } = createCapturingDatabase();
    const scheduler = createDrizzleJobScheduler(database);

    await expect(
      scheduler.upsertSchedule({ cron: "*/15 * * * *", type: "email.digest", workspaceId: "ws_1" }),
    ).rejects.toThrow(/hourly/i);
    expect(calls.executeSql).toHaveLength(0);
    expect(calls.insertValues).toHaveLength(0);
  });

  it("enforces the workspace schedule quota under the same advisory-locked transaction", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.quotaRows = [{ schedule_count: MAX_WORKSPACE_SCHEDULES, already_exists: false }];
    const scheduler = createDrizzleJobScheduler(database);

    await expect(
      scheduler.upsertSchedule({ cron: CRON, type: "email.digest", workspaceId: "ws_1" }),
    ).rejects.toThrow(WorkspaceScheduleLimitError);

    expect(calls.executeSql[0]!.toLowerCase()).toContain("pg_advisory_xact_lock");
    expect(calls.executeSql[1]!.toLowerCase()).toContain("count(*)");
    expect(calls.insertValues).toHaveLength(0);
  });

  it("allows updating an existing type at the workspace quota", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.quotaRows = [{ schedule_count: MAX_WORKSPACE_SCHEDULES, already_exists: true }];
    calls.returningRows = [
      {
        cron: CRON,
        enabled: true,
        id: "sch_existing",
        input: null,
        lastRunAt: null,
        nextRunAt: new Date("2026-03-04T10:00:00.000Z"),
        type: "email.digest",
        workspaceId: "ws_1",
      },
    ];
    const scheduler = createDrizzleJobScheduler(database);

    const schedule = await scheduler.upsertSchedule({
      cron: CRON,
      type: "email.digest",
      workspaceId: "ws_1",
    });

    expect(schedule.id).toBe("sch_existing");
    expect(calls.insertValues).toHaveLength(1);
  });

  it("rejects invalid claim input before touching the database", async () => {
    const scheduler = createDrizzleJobScheduler(null as never);

    await expect(scheduler.claimDueSchedules({ now: new Date("not a date") })).rejects.toThrow();
    await expect(scheduler.claimDueSchedules({ now: "now" as never })).rejects.toThrow();
    for (const limit of [0, -1, 1.5, Number.NaN, MAX_CLAIM_LIMIT + 1]) {
      await expect(scheduler.claimDueSchedules({ limit, now: NOW })).rejects.toThrow();
    }
  });

  it("rejects invalid remove input before touching the database", async () => {
    const scheduler = createDrizzleJobScheduler(null as never);

    await expect(
      scheduler.removeSchedule({ scheduleId: "", workspaceId: "ws_1" }),
    ).rejects.toThrow();
    await expect(
      scheduler.removeSchedule({ scheduleId: "sch_1", workspaceId: "" }),
    ).rejects.toThrow();
    await expect(scheduler.listSchedules("")).rejects.toThrow();
  });
});

describe("createDrizzleJobScheduler upsert", () => {
  it("upserts a deterministic-id schedule scoped to its workspace (NULL-safe)", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.returningRows = [
      {
        cron: "17 3 * * *",
        enabled: true,
        id: "platform:rate-limit.prune",
        input: {},
        last_run_at: null,
        lastRunAt: null,
        next_run_at: new Date("2026-03-05T03:17:00.000Z"),
        nextRunAt: new Date("2026-03-05T03:17:00.000Z"),
        type: "rate-limit.prune",
        workspace_id: null,
        workspaceId: null,
      },
    ];
    const scheduler = createDrizzleJobScheduler(database);

    const row = await scheduler.upsertSchedule({
      cron: "17 3 * * *",
      id: "platform:rate-limit.prune",
      input: {},
      type: "rate-limit.prune",
      workspaceId: null,
    });

    expect(row.id).toBe("platform:rate-limit.prune");
    expect(row.workspaceId).toBeNull();
    expect(calls.insertValues).toHaveLength(1);
    const inserted = calls.insertValues[0]!;
    expect(inserted.id).toBe("platform:rate-limit.prune");
    expect(inserted.workspaceId).toBeNull();
    expect(inserted.enabled).toBe(true);
    expect(inserted.nextRunAt).toBeInstanceOf(Date);
    expect(calls.onConflict).toHaveLength(1);
    // The conflict guard must compare workspaces NULL-safely so a workspace
    // caller cannot overwrite a platform (or foreign-workspace) row by id.
    expect(calls.onConflict[0]!.setWhere).toBeDefined();
    expect(calls.onConflict[0]!.set.enabled).toBe(true);
    expect(calls.onConflict[0]!.set.nextRunAt).toBeInstanceOf(Date);
    // The deterministic-id upsert never touches the claim-owned counter.
    expect(calls.onConflict[0]!.set).not.toHaveProperty("missedRuns");
  });

  it("throws ScheduleNotFoundError when the id conflicts in another scope", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.returningRows = [];
    const scheduler = createDrizzleJobScheduler(database);

    await expect(
      scheduler.upsertSchedule({
        cron: CRON,
        id: "platform:rate-limit.prune",
        input: null,
        type: "x",
        workspaceId: "ws_1",
      }),
    ).rejects.toThrow(ScheduleNotFoundError);
  });

  it("upserts on the real (workspace_id, type) conflict target when no id is given", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.returningRows = [
      {
        cron: CRON,
        enabled: false,
        id: "sch_existing",
        input: { keep: "me" },
        lastRunAt: null,
        nextRunAt: null,
        type: "email.digest",
        workspaceId: "ws_1",
      },
    ];
    const scheduler = createDrizzleJobScheduler(database);

    const row = await scheduler.upsertSchedule({
      cron: CRON,
      enabled: false,
      type: "email.digest",
      workspaceId: "ws_1",
    });

    expect(row.id).toBe("sch_existing");
    // No select-then-update: one INSERT … ON CONFLICT (workspace_id, type)
    // WHERE workspace_id IS NOT NULL DO UPDATE — the partial unique index
    // is the conflict arbiter, so concurrent upserts can't double-insert.
    expect(calls.selectRows).toHaveLength(0);
    expect(calls.updateSets).toHaveLength(0);
    expect(calls.insertValues).toHaveLength(1);
    expect(calls.onConflict).toHaveLength(1);
    const conflict = calls.onConflict[0]!;
    expect(conflict.target).toEqual([jobSchedule.workspaceId, jobSchedule.type]);
    expect(conflict.targetWhere).toBeDefined();
    // Disabled schedules carry no nextRunAt; input stays untouched when omitted.
    expect(conflict.set.nextRunAt).toBeNull();
    expect(conflict.set.enabled).toBe(false);
    expect(conflict.set).not.toHaveProperty("input");
    // missed_runs is claim-owned: inserts rely on the column default and
    // conflicts must never overwrite the accumulated count.
    expect(calls.insertValues[0]).not.toHaveProperty("missedRuns");
    expect(conflict.set).not.toHaveProperty("missedRuns");
  });

  it("writes a provided input payload through the conflict update", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.returningRows = [
      {
        cron: CRON,
        enabled: true,
        id: "sch_existing",
        input: { fresh: true },
        lastRunAt: null,
        nextRunAt: new Date("2026-03-04T09:10:00.000Z"),
        type: "email.digest",
        workspaceId: "ws_1",
      },
    ];
    const scheduler = createDrizzleJobScheduler(database);

    await scheduler.upsertSchedule({
      cron: CRON,
      input: { fresh: true },
      type: "email.digest",
      workspaceId: "ws_1",
    });

    expect(calls.onConflict[0]!.set).toMatchObject({ input: { fresh: true } });
  });

  it("normalizes the job type to lowercase so dispatch stays case-consistent", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.returningRows = [
      {
        cron: CRON,
        enabled: true,
        id: "sch_1",
        input: null,
        lastRunAt: null,
        nextRunAt: new Date("2026-03-04T09:10:00.000Z"),
        type: "email.digest",
        workspaceId: "ws_1",
      },
    ];
    const scheduler = createDrizzleJobScheduler(database);

    await scheduler.upsertSchedule({
      cron: CRON,
      type: "Email.DIGEST",
      workspaceId: "ws_1",
    });

    expect(calls.insertValues[0]!.type).toBe("email.digest");
  });

  it("still dedupes (platform, type) by select-then-update when workspaceId is null", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.selectRows = [{ id: "sch_platform" }];
    calls.returningRows = [
      {
        cron: CRON,
        enabled: true,
        id: "sch_platform",
        input: null,
        lastRunAt: null,
        nextRunAt: new Date("2026-03-04T09:10:00.000Z"),
        type: "platform.job",
        workspaceId: null,
      },
    ];
    const scheduler = createDrizzleJobScheduler(database);

    const row = await scheduler.upsertSchedule({
      cron: CRON,
      type: "platform.job",
      workspaceId: null,
    });

    // The partial unique index excludes NULL workspace_id — platform scope
    // has no conflict target, so it keeps the select-then-update path.
    expect(row.id).toBe("sch_platform");
    expect(calls.updateSets).toHaveLength(1);
    expect(calls.onConflict).toHaveLength(0);
  });

  it("distinguishes an unschedulable cron from an invalid one — and pre-stages it disabled", async () => {
    const { calls, database } = createCapturingDatabase();
    const scheduler = createDrizzleJobScheduler(database);

    // "0 0 30 2 *" (Feb 30) parses but never fires — not a parse failure.
    await expect(
      scheduler.upsertSchedule({ cron: "0 0 30 2 *", type: "x", workspaceId: "ws_1" }),
    ).rejects.toThrow(/never fires|unschedulable/i);
    await expect(
      scheduler.upsertSchedule({ cron: "not a cron", type: "x", workspaceId: "ws_1" }),
    ).rejects.toThrow(/invalid cron/i);

    // Pre-staging the same cron disabled is allowed — nextRunAt stays null.
    calls.returningRows = [
      {
        cron: "0 0 30 2 *",
        enabled: false,
        id: "sch_staged",
        input: null,
        lastRunAt: null,
        nextRunAt: null,
        type: "x",
        workspaceId: "ws_1",
      },
    ];
    const row = await scheduler.upsertSchedule({
      cron: "0 0 30 2 *",
      enabled: false,
      type: "x",
      workspaceId: "ws_1",
    });
    expect(row.enabled).toBe(false);
    expect(row.nextRunAt).toBeNull();
  });
});

describe("createDrizzleJobScheduler list/remove", () => {
  it("lists schedules for the workspace", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.selectRows = [
      {
        cron: CRON,
        enabled: true,
        id: "sch_1",
        input: null,
        lastRunAt: null,
        missedRuns: 7,
        nextRunAt: NOW,
        type: "a",
        workspaceId: "ws_1",
      },
    ];
    const scheduler = createDrizzleJobScheduler(database);

    const rows = await scheduler.listSchedules("ws_1");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe("sch_1");
    expect(rows[0]!.workspaceId).toBe("ws_1");
    // The cumulative missed-run counter projects through toCronSchedule.
    expect(rows[0]!.missedRuns).toBe(7);
  });

  it("removes a schedule scoped by workspace and reports misses", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.returningRows = [{ id: "sch_1" }];
    const scheduler = createDrizzleJobScheduler(database);
    await expect(
      scheduler.removeSchedule({ scheduleId: "sch_1", workspaceId: "ws_1" }),
    ).resolves.toBeUndefined();
    expect(calls.deleteWheres).toHaveLength(1);

    calls.returningRows = [];
    await expect(
      scheduler.removeSchedule({ scheduleId: "sch_1", workspaceId: "ws_1" }),
    ).rejects.toThrow(ScheduleNotFoundError);
  });
});

describe("createDrizzleJobScheduler claimDueSchedules", () => {
  it("claims due rows under FOR UPDATE SKIP LOCKED and advances each in one transaction", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.dueRows = [DUE_ROW];
    const scheduler = createDrizzleJobScheduler(database);

    const claimed = await scheduler.claimDueSchedules({ limit: 10, now: NOW });

    // Rank due rows per workspace before the global limit, then lock the
    // selected schedule rows with SKIP LOCKED. This bounds each tenant's
    // share while keeping one atomic claim transaction.
    const selectSql = calls.executeSql[0]!;
    expect(selectSql.toLowerCase()).toContain('from "job_schedule"');
    expect(selectSql.toLowerCase()).toContain("row_number() over");
    expect(selectSql.toLowerCase()).toContain('partition by "workspace_id"');
    expect(selectSql.toLowerCase()).toContain("<= $2");
    expect(selectSql.toLowerCase()).toContain("for update of schedule skip locked");
    expect(selectSql).toContain('"enabled"');
    expect(selectSql).toContain('"next_run_at"');
    expect(selectSql).toContain('"missed_runs"');
    expect(calls.executeParams[0]).toEqual([NOW.toISOString(), WORKSPACE_CLAIM_LIMIT, 10]);

    // Each claimed row advances in the same transaction, adding its
    // missed-occurrence delta onto the stored counter.
    const updateSql = calls.executeSql[1]!;
    expect(updateSql.toLowerCase()).toContain('update "job_schedule"');
    expect(updateSql).toContain('"last_run_at"');
    expect(updateSql).toContain('"next_run_at"');
    expect(updateSql).toContain('"missed_runs"');
    expect(calls.executeParams[1]![0]).toBe(NOW.toISOString());
    // cron "0 * * * *" after 09:00Z → next fire 10:00Z.
    expect(calls.executeParams[1]![1]).toBe("2026-03-04T10:00:00.000Z");
    // One hourly occurrence (09:00Z) elapsed between the stored 08:00Z run
    // and the 09:00Z claim → the UPDATE adds delta 1.
    expect(calls.executeParams[1]![2]).toBe(1);
    expect(calls.executeParams[1]![3]).toBe("sch_due");

    expect(claimed).toHaveLength(1);
    expect(claimed[0]!.id).toBe("sch_due");
    expect(claimed[0]!.workspaceId).toBe("ws_1");
    expect(claimed[0]!.lastRunAt).toEqual(NOW);
    expect(claimed[0]!.nextRunAt).toEqual(new Date("2026-03-04T10:00:00.000Z"));
    // Returned rows carry the post-claim cumulative total plus the delta
    // this claim added (2 stored + 1 elapsed).
    expect(claimed[0]!.missedRuns).toBe(3);
    expect(claimed[0]!.missedDelta).toBe(1);
  });

  it("counts every elapsed occurrence when a claim runs days late", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.dueRows = [
      {
        ...DUE_ROW,
        // Daily 09:00 — stored occurrence Mon 09:00, claimed Thu 12:00:
        // Tue/Wed/Thu 09:00 elapsed unclaimed → delta 3 on top of the
        // stored cumulative 2.
        cron: "0 9 * * *",
        next_run_at: new Date("2026-03-02T09:00:00.000Z"), // Monday
        missed_runs: 2,
      },
    ];
    const scheduler = createDrizzleJobScheduler(database);

    const claimed = await scheduler.claimDueSchedules({
      now: new Date("2026-03-05T12:00:00.000Z"),
    });

    expect(claimed).toHaveLength(1);
    expect(claimed[0]!.missedDelta).toBe(3);
    expect(claimed[0]!.missedRuns).toBe(5);
    expect(calls.executeParams[1]![2]).toBe(3);
  });

  it("claims an on-time row with a zero missed delta", async () => {
    const { calls, database } = createCapturingDatabase();
    // next_run_at exactly at the tick — nothing elapsed after it.
    calls.dueRows = [{ ...DUE_ROW, next_run_at: NOW, missed_runs: 0 }];
    const scheduler = createDrizzleJobScheduler(database);

    const claimed = await scheduler.claimDueSchedules({ now: NOW });
    expect(claimed[0]!.missedDelta).toBe(0);
    expect(claimed[0]!.missedRuns).toBe(0);
    expect(calls.executeParams[1]![2]).toBe(0);
  });

  it("claims nothing when no rows are due", async () => {
    const { database } = createCapturingDatabase();
    const scheduler = createDrizzleJobScheduler(database);
    await expect(scheduler.claimDueSchedules({ now: NOW })).resolves.toEqual([]);
  });

  it("dryRun previews the claim without mutating — no UPDATE statements", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.dueRows = [DUE_ROW, { ...DUE_ROW, id: "sch_due_2" }];
    const scheduler = createDrizzleJobScheduler(database);

    const previewed = await scheduler.claimDueSchedules({ dryRun: true, limit: 10, now: NOW });

    // Same SELECT contract — the dry run must see exactly what a real tick
    // would claim (locking is harmless inside the read-only transaction).
    expect(calls.executeSql).toHaveLength(1);
    expect(calls.executeSql[0]!.toLowerCase()).toContain("for update of schedule skip locked");

    // Rows still project the post-claim state — including the missed-run
    // delta and projected cumulative — so callers can see the fire time
    // and the advance a real tick would stamp.
    expect(previewed).toHaveLength(2);
    expect(previewed[0]!.lastRunAt).toEqual(NOW);
    expect(previewed[0]!.nextRunAt).toEqual(new Date("2026-03-04T10:00:00.000Z"));
    expect(previewed[0]!.missedDelta).toBe(1);
    expect(previewed[0]!.missedRuns).toBe(3);
  });

  it("parks a schedule whose stored cron no longer resolves (nextRunAt → null)", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.dueRows = [{ ...DUE_ROW, cron: "0 0 29 2 *", id: "sch_rare" }];
    const scheduler = createDrizzleJobScheduler(database);

    const claimed = await scheduler.claimDueSchedules({ now: NOW });
    expect(claimed).toHaveLength(1);
    expect(claimed[0]!.nextRunAt).toBeNull();
    expect(calls.executeParams[1]![1]).toBeNull();
  });
});
