import { randomUUID } from "node:crypto";

import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { jobSchedule } from "@supastack/db";
import type * as schema from "@supastack/db/schema";

import {
  countCronRuns,
  nextCronRun,
  isAtLeastHourlyCron,
  parseCronExpression,
  ScheduleNotFoundError,
  type ClaimedCronSchedule,
  type CronSchedule,
  type JobScheduler,
} from "./scheduler";

type SchedulerDatabase = PostgresJsDatabase<typeof schema>;
type JobScheduleRow = typeof jobSchedule.$inferSelect;

/** Upper bound on rows a single tick may claim — keeps one transaction small. */
export const MAX_CLAIM_LIMIT = 500;
/** Maximum number of distinct recurring schedules one workspace may retain. */
export const MAX_WORKSPACE_SCHEDULES = 20;
/** Per-workspace claim cap prevents a single tenant filling every tick batch. */
export const WORKSPACE_CLAIM_LIMIT = 10;
const DEFAULT_CLAIM_LIMIT = 100;
const SCHEDULE_TYPE_PATTERN = /^[a-z0-9._-]+$/i;

export class WorkspaceScheduleLimitError extends Error {
  constructor() {
    super(`A workspace may have at most ${MAX_WORKSPACE_SCHEDULES} schedules.`);
    this.name = "WorkspaceScheduleLimitError";
  }
}

/**
 * `ScheduleInput` widened for the durable store: `workspaceId` may be `null`
 * (platform-level schedule, e.g. rate-limit bucket pruning) and `enabled` /
 * `input` are optional. Workspace callers still satisfy `ScheduleInput`.
 */
export type DrizzleScheduleInput = Readonly<{
  cron: string;
  /** Defaults to `true`; disabled schedules carry `nextRunAt: null`. */
  enabled?: boolean;
  /** Deterministic id for platform seeds (`platform:…`); generated otherwise. */
  id?: string;
  /**
   * `undefined` semantics differ by upsert path: on the per-`(workspace,
   * type)` update it leaves the stored payload untouched; the
   * deterministic-id upsert always rewrites it (`undefined` → `null`).
   */
  input?: unknown;
  type: string;
  /** `null` registers a platform-level schedule owned by no workspace. */
  workspaceId: string | null;
}>;

export interface ClaimDueSchedulesInput {
  /**
   * Preview only: run the same `FOR UPDATE SKIP LOCKED` select but skip the
   * per-row advance UPDATE, so nothing is mutated. The row locks are
   * intentional — the preview must observe exactly what a real tick could
   * claim — and they release when the transaction commits a moment later.
   * Returned rows still carry the projected post-claim state (`lastRunAt =
   * now`, `nextRunAt` = the run a real claim would stamp) so callers see
   * exactly what a tick would do.
   */
  readonly dryRun?: boolean;
  readonly now: Date;
  readonly limit?: number;
}

export interface DrizzleJobScheduler extends JobScheduler {
  /**
   * Claims every due schedule (`enabled AND next_run_at <= now`) in ONE
   * transaction: rows are selected `FOR UPDATE SKIP LOCKED`, then stamped
   * `last_run_at = now` / advanced to `nextCronRun(cron, now)` before commit.
   * Concurrent ticks therefore can never double-claim a row.
   *
   * At-most-once per fire: a crash between this commit and the caller's
   * enqueue loses that one fire — the row is already advanced. Acceptable
   * because job handlers are idempotent by contract and a lost fire
   * self-heals on the next tick for any schedule still due. Returned rows
   * carry the post-claim state (`lastRunAt` is the fire time) plus the
   * missed-occurrence accounting: `missedDelta` is the number of cron
   * occurrences that elapsed between the stored `next_run_at` and `now`
   * (`missed_runs` is incremented by it in the same UPDATE).
   * `input.dryRun` previews the same due set without advancing any row.
   */
  claimDueSchedules(input: ClaimDueSchedulesInput): Promise<readonly ClaimedCronSchedule[]>;
  upsertSchedule(input: DrizzleScheduleInput): Promise<CronSchedule>;
}

/**
 * `JobScheduler` over the `job_schedule` table — the production scheduler
 * behind `tickScheduler`; `LocalJobScheduler` stays the in-memory test/local
 * double.
 */
export function createDrizzleJobScheduler(database: SchedulerDatabase): DrizzleJobScheduler {
  return Object.freeze({
    async claimDueSchedules(
      input: ClaimDueSchedulesInput,
    ): Promise<readonly ClaimedCronSchedule[]> {
      const now = requireValidDate(input?.now);
      const limit = normalizeClaimLimit(input.limit);
      const nowIso = now.toISOString();

      return database.transaction(async (tx) => {
        const dueRows = await tx.execute<JobScheduleClaimRow>(sql`
          WITH ranked AS (
            SELECT "id",
                   ROW_NUMBER() OVER (
                     PARTITION BY "workspace_id"
                     ORDER BY "next_run_at" ASC, "created_at" ASC, "id" ASC
                   ) AS "workspace_rank"
            FROM "job_schedule"
            WHERE "enabled" = true
              AND "next_run_at" IS NOT NULL
              AND "next_run_at" <= ${nowIso}::timestamptz
          )
          SELECT schedule."id", schedule."workspace_id", schedule."type", schedule."cron",
                 schedule."input", schedule."enabled", schedule."last_run_at",
                 schedule."next_run_at", schedule."missed_runs", schedule."created_at",
                 schedule."updated_at"
          FROM "job_schedule" AS schedule
          INNER JOIN ranked ON ranked."id" = schedule."id"
          WHERE ranked."workspace_rank" <= ${WORKSPACE_CLAIM_LIMIT}
          ORDER BY schedule."next_run_at" ASC, schedule."created_at" ASC, schedule."id" ASC
          LIMIT ${limit}
          FOR UPDATE OF schedule SKIP LOCKED
        `);

        const claimed: ClaimedCronSchedule[] = [];
        for (const row of dueRows) {
          // A stored cron that no longer resolves parks the schedule
          // (next_run_at → NULL) instead of failing the whole batch.
          const next = nextCronRun(row.cron, now);
          const nextIso = next === null ? null : next.toISOString();
          // The claimed fire IS the stored next_run_at occurrence
          // dispatched late — occurrences strictly after it up to `now`
          // elapsed unclaimed (the WHERE guarantees next_run_at non-null).
          const missedDelta = countCronRuns(row.cron, new Date(row.next_run_at!), now);
          if (input.dryRun !== true) {
            await tx.execute(sql`
              UPDATE "job_schedule"
              SET "last_run_at" = ${nowIso}::timestamptz,
                  "next_run_at" = ${nextIso}::timestamptz,
                  "missed_runs" = "missed_runs" + ${missedDelta},
                  "updated_at" = now()
              WHERE "id" = ${row.id}
            `);
          }
          claimed.push({
            cron: row.cron,
            enabled: row.enabled,
            id: row.id,
            input: row.input,
            lastRunAt: now,
            missedDelta,
            // dryRun projects the post-claim total without writing it.
            missedRuns: row.missed_runs + missedDelta,
            nextRunAt: next,
            type: row.type,
            workspaceId: row.workspace_id,
          });
        }
        return claimed;
      });
    },

    async listSchedules(workspaceId: string): Promise<readonly CronSchedule[]> {
      const scope = requireWorkspaceId(workspaceId);
      const rows = await database
        .select()
        .from(jobSchedule)
        .where(eq(jobSchedule.workspaceId, scope))
        .orderBy(asc(jobSchedule.type), asc(jobSchedule.id));
      return rows.map(toCronSchedule);
    },

    async removeSchedule(
      query: Readonly<{ scheduleId: string; workspaceId: string | null }>,
    ): Promise<void> {
      const scheduleId = requireScheduleId(query?.scheduleId);
      const workspaceId = normalizeWorkspaceId(query.workspaceId);
      const removed = await database
        .delete(jobSchedule)
        .where(and(eq(jobSchedule.id, scheduleId), workspaceGuard(workspaceId)))
        .returning({ id: jobSchedule.id });
      if (removed.length === 0) {
        throw new ScheduleNotFoundError();
      }
    },

    async upsertSchedule(input: DrizzleScheduleInput): Promise<CronSchedule> {
      const normalized = normalizeScheduleInput(input);
      if (normalized.workspaceId !== null && !isAtLeastHourlyCron(normalized.cron)) {
        throw new Error("Workspace schedules must run hourly or less frequently.");
      }
      const now = new Date();
      const nextRunAt = normalized.enabled ? nextCronRun(normalized.cron, now) : null;
      if (normalized.enabled && nextRunAt === null) {
        // The cron parsed (normalizeScheduleInput) but has no run inside the
        // search window — unschedulable, not malformed. Disabled schedules
        // may still be pre-staged; only an enabled upsert must fire.
        throw new Error(
          `Cron expression is valid but never fires inside the scheduler window: ${normalized.cron}`,
        );
      }

      if (normalized.workspaceId !== null) {
        return database.transaction(async (tx) => {
          // Serialize all schedule creations for one workspace across app
          // instances. The lock remains held until the insert/update commits.
          await tx.execute(sql`
            SELECT pg_advisory_xact_lock(hashtextextended(${normalized.workspaceId}, 0))
          `);
          const quotaRows = await tx.execute<{
            already_exists: boolean;
            schedule_count: number;
          }>(sql`
            SELECT COUNT(*)::int AS "schedule_count",
                   (
                     COALESCE(BOOL_OR("type" = ${normalized.type}), false)
                     OR COALESCE(BOOL_OR("id" = ${normalized.id ?? ""}), false)
                   ) AS "already_exists"
            FROM "job_schedule"
            WHERE "workspace_id" = ${normalized.workspaceId}
          `);
          const quota = quotaRows[0];
          if (
            Number(quota?.schedule_count ?? 0) >= MAX_WORKSPACE_SCHEDULES &&
            quota?.already_exists !== true
          ) {
            throw new WorkspaceScheduleLimitError();
          }

          if (normalized.id !== undefined) {
            // Deterministic ids upsert in scope; the lock and quota check are
            // held in the same transaction as this write.
            const rows = await tx
              .insert(jobSchedule)
              .values({
                createdAt: now,
                cron: normalized.cron,
                enabled: normalized.enabled,
                id: normalized.id,
                input: normalized.input ?? null,
                lastRunAt: null,
                nextRunAt,
                type: normalized.type,
                updatedAt: now,
                workspaceId: normalized.workspaceId,
              })
              .onConflictDoUpdate({
                set: {
                  cron: normalized.cron,
                  enabled: normalized.enabled,
                  input: normalized.input ?? null,
                  nextRunAt,
                  type: normalized.type,
                  updatedAt: now,
                },
                setWhere: sql`"job_schedule"."workspace_id" IS NOT DISTINCT FROM "excluded"."workspace_id"`,
                target: jobSchedule.id,
              })
              .returning();
            const row = rows[0];
            if (row === undefined) {
              throw new ScheduleNotFoundError();
            }
            return toCronSchedule(row);
          }

          const rows = await tx
            .insert(jobSchedule)
            .values({
              createdAt: now,
              cron: normalized.cron,
              enabled: normalized.enabled,
              id: `sch_${randomUUID()}`,
              input: normalized.input ?? null,
              lastRunAt: null,
              nextRunAt,
              type: normalized.type,
              updatedAt: now,
              workspaceId: normalized.workspaceId,
            })
            .onConflictDoUpdate({
              set: {
                cron: normalized.cron,
                enabled: normalized.enabled,
                nextRunAt,
                updatedAt: now,
                ...(normalized.input === undefined ? {} : { input: normalized.input }),
              },
              target: [jobSchedule.workspaceId, jobSchedule.type],
              targetWhere: sql`"job_schedule"."workspace_id" IS NOT NULL`,
            })
            .returning();
          const row = rows[0];
          if (row === undefined) {
            throw new Error("Schedule upsert returned no row.");
          }
          return toCronSchedule(row);
        });
      }

      if (normalized.id !== undefined) {
        // Deterministic ids (platform seeds) upsert in place — but only within
        // the same scope: the `setWhere` guard makes a cross-workspace (or
        // workspace→platform) hijack a silent no-op we then report.
        const rows = await database
          .insert(jobSchedule)
          .values({
            createdAt: now,
            cron: normalized.cron,
            enabled: normalized.enabled,
            id: normalized.id,
            input: normalized.input ?? null,
            lastRunAt: null,
            nextRunAt,
            type: normalized.type,
            updatedAt: now,
            workspaceId: normalized.workspaceId,
          })
          .onConflictDoUpdate({
            set: {
              cron: normalized.cron,
              enabled: normalized.enabled,
              input: normalized.input ?? null,
              nextRunAt,
              type: normalized.type,
              updatedAt: now,
            },
            setWhere: sql`"job_schedule"."workspace_id" IS NOT DISTINCT FROM "excluded"."workspace_id"`,
            target: jobSchedule.id,
          })
          .returning();
        const row = rows[0];
        if (row === undefined) {
          throw new ScheduleNotFoundError();
        }
        return toCronSchedule(row);
      }

      // Caller chose no id — the per-(workspace, type) upsert: one schedule
      // of each type per workspace. Workspace rows conflict onto the partial
      // unique index `idx_job_schedule_workspace_type` (a real ON CONFLICT —
      // no read-then-write race); the predicate must repeat the index's WHERE
      // so Postgres can infer it. `input: undefined` leaves the stored
      // payload untouched on conflict, same as the old update path.
      // Platform scope (workspace_id NULL) is outside the partial index —
      // no conflict target exists for it. Platform seeds carry deterministic
      // ids and take the id path above; a no-id platform upsert keeps the
      // select-then-update/insert behavior (its race is benign: seeding is
      // idempotent and the same type collapses to one row).
      const [existing] = await database
        .select({ id: jobSchedule.id })
        .from(jobSchedule)
        .where(and(isNull(jobSchedule.workspaceId), eq(jobSchedule.type, normalized.type)))
        .limit(1);

      if (existing !== undefined) {
        const rows = await database
          .update(jobSchedule)
          .set({
            cron: normalized.cron,
            enabled: normalized.enabled,
            nextRunAt,
            updatedAt: now,
            ...(normalized.input === undefined ? {} : { input: normalized.input }),
          })
          .where(eq(jobSchedule.id, existing.id))
          .returning();
        const row = rows[0];
        if (row === undefined) {
          throw new ScheduleNotFoundError();
        }
        return toCronSchedule(row);
      }

      const rows = await database
        .insert(jobSchedule)
        .values({
          createdAt: now,
          cron: normalized.cron,
          enabled: normalized.enabled,
          id: `sch_${randomUUID()}`,
          input: normalized.input ?? null,
          lastRunAt: null,
          nextRunAt,
          type: normalized.type,
          updatedAt: now,
          workspaceId: null,
        })
        .returning();
      const row = rows[0];
      if (row === undefined) {
        throw new Error("Schedule insert returned no row.");
      }
      return toCronSchedule(row);
    },
  });
}

type JobScheduleClaimRow = Readonly<{
  created_at: Date | string;
  cron: string;
  enabled: boolean;
  id: string;
  input: unknown;
  last_run_at: Date | string | null;
  missed_runs: number;
  next_run_at: Date | string | null;
  type: string;
  updated_at: Date | string;
  workspace_id: string | null;
}>;

function toCronSchedule(row: JobScheduleRow): CronSchedule {
  return {
    cron: row.cron,
    enabled: row.enabled,
    id: row.id,
    input: row.input,
    lastRunAt: row.lastRunAt,
    missedRuns: row.missedRuns,
    nextRunAt: row.nextRunAt,
    type: row.type,
    workspaceId: row.workspaceId,
  };
}

/** `eq` cannot express NULL; platform schedules compare with IS NULL. */
function workspaceGuard(workspaceId: string | null) {
  return workspaceId === null
    ? isNull(jobSchedule.workspaceId)
    : eq(jobSchedule.workspaceId, workspaceId);
}

type NormalizedScheduleInput = Readonly<{
  cron: string;
  enabled: boolean;
  id?: string;
  input: unknown;
  type: string;
  workspaceId: string | null;
}>;

function normalizeScheduleInput(input: DrizzleScheduleInput): NormalizedScheduleInput {
  if (typeof input !== "object" || input === null) {
    throw new Error("A valid schedule input is required.");
  }
  const cron = typeof input.cron === "string" ? input.cron.trim() : "";
  if (!parseCronExpression(cron).ok) {
    throw new Error(`Invalid cron expression: ${String(input.cron)}`);
  }
  // Dispatch (`handlers[type]`) is case-sensitive while the pattern is not —
  // normalize to lowercase so a stored type always matches its handler.
  const type = typeof input.type === "string" ? input.type.trim().toLowerCase() : "";
  if (type.length === 0 || type.length > 64 || !SCHEDULE_TYPE_PATTERN.test(type)) {
    throw new Error("A valid schedule type is required.");
  }
  const workspaceId = normalizeWorkspaceId(input.workspaceId);
  const id = input.id === undefined ? undefined : requireScheduleId(input.id);
  return {
    cron,
    enabled: input.enabled ?? true,
    ...(id === undefined ? {} : { id }),
    input: input.input,
    type,
    workspaceId,
  };
}

function normalizeWorkspaceId(workspaceId: string | null): string | null {
  if (workspaceId === null) {
    return null;
  }
  return requireWorkspaceId(workspaceId);
}

function requireWorkspaceId(workspaceId: string): string {
  if (typeof workspaceId !== "string" || workspaceId.trim().length === 0) {
    throw new Error("A valid workspace is required.");
  }
  return workspaceId;
}

function requireScheduleId(scheduleId: string): string {
  if (typeof scheduleId !== "string" || scheduleId.trim().length === 0) {
    throw new Error("A valid schedule id is required.");
  }
  return scheduleId;
}

function requireValidDate(value: Date): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error("A valid tick time is required.");
  }
  return value;
}

function normalizeClaimLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_CLAIM_LIMIT;
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_CLAIM_LIMIT) {
    throw new Error(`A claim limit between 1 and ${MAX_CLAIM_LIMIT} is required.`);
  }
  return limit;
}
