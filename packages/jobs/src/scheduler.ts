import { randomUUID } from "node:crypto";

import type { JobRunner } from "./index";

/**
 * Cron schedules. JobRunner intentionally stays narrow (enqueue/status/cancel);
 * recurring work is an explicit, separate contract — matching Trigger.dev's
 * `schedules` API — so a consuming product can swap in the provider scheduler
 * without changing call sites.
 */

export type CronSchedule = Readonly<{
  cron: string;
  enabled: boolean;
  id: string;
  input: unknown;
  lastRunAt: Date | null;
  /**
   * Cumulative occurrences that elapsed unclaimed — every occurrence the
   * cron produced after a stored `nextRunAt` while no tick ran to claim
   * it. Claim-time delta, never reset by upserts — but an upsert
   * re-anchors `nextRunAt` from now, forgiving any gap still in flight
   * (those occurrences are never claimed OR counted).
   */
  missedRuns: number;
  nextRunAt: Date | null;
  type: string;
  /** Owning workspace; `null` marks a platform-level schedule (job_schedule allows NULL). */
  workspaceId: string | null;
}>;

/**
 * A claimed fire IS the stored `nextRunAt` occurrence — dispatched late
 * when the tick ran behind. `missedDelta` counts the occurrences that
 * elapsed after it (`stored nextRunAt < t <= now`) and is already folded
 * into `missedRuns`. Structurally still a `CronSchedule`.
 */
export type ClaimedCronSchedule = CronSchedule &
  Readonly<{
    /** Occurrences this claim counted as missed — the delta added to `missedRuns`. */
    missedDelta: number;
  }>;

export type ScheduleInput = Readonly<{
  cron: string;
  /** Defaults to `true`; disabled schedules carry `nextRunAt: null`. */
  enabled?: boolean;
  id?: string;
  input: unknown;
  type: string;
  workspaceId: string;
}>;

export interface JobScheduler {
  listSchedules(workspaceId: string): Promise<readonly CronSchedule[]>;
  removeSchedule(query: Readonly<{ scheduleId: string; workspaceId: string }>): Promise<void>;
  upsertSchedule(input: ScheduleInput): Promise<CronSchedule>;
}

const FIELD_RANGES = [
  [0, 59], // minute
  [0, 23], // hour
  [1, 31], // day of month
  [1, 12], // month
  [0, 6], // day of week
] as const;

function parseField(field: string, [min, max]: readonly [number, number]): Set<number> | null {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    const stepMatch = /^(.+)\/(\d+)$/.exec(part);
    const base = stepMatch ? stepMatch[1]! : part;
    const step = stepMatch ? Number(stepMatch[2]) : 1;
    if (!Number.isInteger(step) || step < 1) return null;

    let lo: number;
    let hi: number;
    if (base === "*") {
      lo = min;
      hi = max;
    } else {
      const range = /^(\d+)-(\d+)$/.exec(base);
      if (range) {
        lo = Number(range[1]);
        hi = Number(range[2]);
      } else if (/^\d+$/.test(base)) {
        lo = hi = Number(base);
        // POSIX: a stepped single value expands to n-max/step — `0/15` is
        // `0-59/15` ({0,15,30,45}), not the fixed value {0}.
        if (stepMatch) hi = max;
      } else {
        return null;
      }
      if (lo < min || hi > max || lo > hi) return null;
    }

    for (let v = lo; v <= hi; v += step) {
      values.add(v);
    }
  }
  return values;
}

type ParsedCron = Readonly<{
  dayOfMonth: Set<number>;
  /** Whether the day-of-month field was restricted — anything but `*`. */
  dayOfMonthRestricted: boolean;
  dayOfWeek: Set<number>;
  /** Whether the day-of-week field was restricted — anything but `*`. */
  dayOfWeekRestricted: boolean;
  hour: Set<number>;
  minute: Set<number>;
  month: Set<number>;
}>;

function parseCron(expression: string): ParsedCron | null {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const parsed = fields.map((field, index) => parseField(field, FIELD_RANGES[index]!));
  if (parsed.some((set) => set === null || set.size === 0)) return null;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parsed as [
    Set<number>,
    Set<number>,
    Set<number>,
    Set<number>,
    Set<number>,
  ];
  return {
    dayOfMonth,
    // POSIX: "restricted" means the field is not literally `*` — `*/n` and
    // full ranges count as restricted for the day-field union below.
    dayOfMonthRestricted: fields[2] !== "*",
    dayOfWeek,
    dayOfWeekRestricted: fields[4] !== "*",
    hour,
    minute,
    month,
  };
}

export function parseCronExpression(expression: string): { ok: boolean } {
  return { ok: parseCron(expression) !== null };
}

/** Workspace schedules run no more than once per hour. */
export function isAtLeastHourlyCron(expression: string): boolean {
  const cron = parseCron(expression);
  return cron !== null && cron.minute.size === 1;
}

/**
 * Next matching minute strictly after `from`, walking minute-by-minute and
 * bailing after ~1 year of iterations or once the cursor passes `within`
 * (an occurrence exactly at `within` still counts). Day fields follow
 * POSIX semantics: when both day-of-month and day-of-week are restricted
 * (not `*`) a run fires when EITHER matches; when only one is restricted
 * that one alone must match.
 */
function nextCronMatch(cron: ParsedCron, from: Date, within?: Date): Date | null {
  const cursor = new Date(from.getTime());
  cursor.setUTCSeconds(0, 0);
  cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);

  for (let i = 0; i < 366 * 24 * 60; i += 1) {
    if (within !== undefined && cursor > within) {
      return null;
    }
    const dayOfMonthMatch = cron.dayOfMonth.has(cursor.getUTCDate());
    const dayOfWeekMatch = cron.dayOfWeek.has(cursor.getUTCDay());
    const dayMatches =
      cron.dayOfMonthRestricted && cron.dayOfWeekRestricted
        ? dayOfMonthMatch || dayOfWeekMatch
        : dayOfMonthMatch && dayOfWeekMatch;
    if (
      cron.minute.has(cursor.getUTCMinutes()) &&
      cron.hour.has(cursor.getUTCHours()) &&
      dayMatches &&
      cron.month.has(cursor.getUTCMonth() + 1)
    ) {
      return cursor;
    }
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  }
  return null;
}

/**
 * Next matching minute strictly after `from` — all fields are compared in
 * UTC — or null when the expression is invalid or has no run inside the
 * ~1-year search window.
 */
export function nextCronRun(expression: string, from: Date): Date | null {
  const cron = parseCron(expression);
  if (cron === null) return null;
  return nextCronMatch(cron, from);
}

/**
 * Upper bound on occurrences counted per claim — a schedule left stale
 * long enough that occurrences number in the tens of thousands saturates
 * here instead of counting forever. (The minute walk is separately
 * bounded by `to` on every step, so this cap only guards dense crons.)
 */
export const MAX_MISSED_RUN_COUNT = 10_000;

/**
 * Cron occurrences strictly after `fromExclusive` and at or before `to` —
 * the runs that elapsed with no tick to claim them. Parses the expression
 * once, then walks occurrences with each step bounded by `to` (a sparse
 * cron's next run past `to` never walks past `to` to find it); saturates
 * at `limit`; an invalid or unschedulable expression counts 0.
 */
export function countCronRuns(
  expression: string,
  fromExclusive: Date,
  to: Date,
  limit: number = MAX_MISSED_RUN_COUNT,
): number {
  const cron = parseCron(expression);
  if (cron === null) return 0;

  let count = 0;
  let cursor = fromExclusive;
  while (count < limit) {
    const next = nextCronMatch(cron, cursor, to);
    if (next === null) {
      break;
    }
    count += 1;
    cursor = next;
  }
  return count;
}

export class ScheduleNotFoundError extends Error {
  constructor() {
    super("The schedule does not exist in this workspace.");
    this.name = "ScheduleNotFoundError";
  }
}

/**
 * Deterministic in-memory scheduler. `tick` enqueues due schedules through an
 * injected JobRunner, so the same workspace-scoped contract drives recurring
 * work in tests and local development. Production swaps in Trigger.dev
 * schedules via the same JobScheduler interface.
 */
/** The in-memory scheduler only accepts workspace-owned schedules. */
type LocalCronSchedule = CronSchedule & Readonly<{ workspaceId: string }>;

export class LocalJobScheduler implements JobScheduler {
  private readonly schedules = new Map<string, LocalCronSchedule>();

  constructor(private readonly runner?: JobRunner) {}

  /**
   * Mirrors the durable scheduler's contract: `type` normalizes to lowercase
   * (dispatch is case-sensitive), an enabled cron must have a run inside the
   * search window while a disabled one may be pre-staged unschedulable, an
   * explicit `id` upserts in place, and without one the (workspace, type)
   * pair dedupes onto the existing row.
   */
  async upsertSchedule(input: ScheduleInput): Promise<CronSchedule> {
    if (!parseCronExpression(input.cron).ok) {
      throw new Error(`Invalid cron expression: ${input.cron}`);
    }
    if (!isAtLeastHourlyCron(input.cron)) {
      throw new Error("Workspace schedules must run hourly or less frequently.");
    }
    const enabled = input.enabled ?? true;
    const next = enabled ? nextCronRun(input.cron, new Date()) : null;
    if (enabled && next === null) {
      if (!parseCronExpression(input.cron).ok) {
        throw new Error(`Invalid cron expression: ${input.cron}`);
      }
      throw new Error(
        `Cron expression is valid but never fires inside the scheduler window: ${input.cron}`,
      );
    }
    const type = input.type.trim().toLowerCase();

    if (input.id !== undefined) {
      const existing = this.schedules.get(input.id);
      if (existing !== undefined && existing.workspaceId !== input.workspaceId) {
        // Same cross-scope guard as the durable scheduler's setWhere clause.
        throw new ScheduleNotFoundError();
      }
      const schedule: LocalCronSchedule = {
        cron: input.cron,
        enabled,
        id: input.id,
        input: input.input ?? null,
        lastRunAt: existing?.lastRunAt ?? null,
        missedRuns: existing?.missedRuns ?? 0,
        nextRunAt: next,
        type,
        workspaceId: input.workspaceId,
      };
      this.schedules.set(input.id, schedule);
      return schedule;
    }

    const existing = [...this.schedules.values()].find(
      (schedule) => schedule.workspaceId === input.workspaceId && schedule.type === type,
    );
    if (existing !== undefined) {
      const schedule: LocalCronSchedule = {
        ...existing,
        cron: input.cron,
        enabled,
        // `input: undefined` leaves the stored payload untouched, matching
        // the durable (workspace,type) update path.
        input: input.input === undefined ? existing.input : input.input,
        nextRunAt: next,
      };
      this.schedules.set(existing.id, schedule);
      return schedule;
    }

    const schedule: LocalCronSchedule = {
      cron: input.cron,
      enabled,
      id: `sch_${randomUUID()}`,
      input: input.input ?? null,
      lastRunAt: null,
      missedRuns: 0,
      nextRunAt: next,
      type,
      workspaceId: input.workspaceId,
    };
    this.schedules.set(schedule.id, schedule);
    return schedule;
  }

  async listSchedules(workspaceId: string): Promise<readonly CronSchedule[]> {
    return [...this.schedules.values()].filter((schedule) => schedule.workspaceId === workspaceId);
  }

  async removeSchedule(
    query: Readonly<{ scheduleId: string; workspaceId: string }>,
  ): Promise<void> {
    const schedule = this.schedules.get(query.scheduleId);
    if (schedule === undefined || schedule.workspaceId !== query.workspaceId) {
      throw new ScheduleNotFoundError();
    }
    this.schedules.delete(query.scheduleId);
  }

  /**
   * Enqueues every enabled schedule whose nextRunAt is at or before `now`,
   * then advances each fired schedule to its next occurrence. The fired
   * run IS the stored occurrence dispatched late — occurrences that
   * elapsed between it and `now` are counted into `missedRuns`.
   */
  async tick(options: Readonly<{ now?: Date }> = {}): Promise<number> {
    if (this.runner === undefined) {
      return 0;
    }
    const now = options.now ?? new Date();
    let ran = 0;
    for (const schedule of [...this.schedules.values()]) {
      if (!schedule.enabled || schedule.nextRunAt === null || schedule.nextRunAt > now) {
        continue;
      }
      const missedDelta = countCronRuns(schedule.cron, schedule.nextRunAt, now);
      await this.runner.enqueue({
        input: schedule.input,
        type: schedule.type,
        workspaceId: schedule.workspaceId,
      });
      this.schedules.set(schedule.id, {
        ...schedule,
        lastRunAt: now,
        missedRuns: schedule.missedRuns + missedDelta,
        nextRunAt: nextCronRun(schedule.cron, now),
      });
      ran += 1;
    }
    return ran;
  }
}
