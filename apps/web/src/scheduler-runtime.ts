import "server-only";

import { parseServerConfig } from "@supastack/config";
import {
  createDrizzleJobScheduler,
  TriggerWorkflowClient,
  type ClaimedCronSchedule,
  type DrizzleJobScheduler,
  type DrizzleScheduleInput,
  type TriggerWorkflowRequest,
} from "@supastack/jobs";
import { newCorrelationId } from "@supastack/observability";
import { configure, tasks } from "@trigger.dev/sdk";

import { database } from "./auth-runtime";
import {
  JOB_RUN_TASK_ID,
  isJobHandlerRegistered,
  runJobHandler,
  type JobHandlerContext,
  type JobHandlerResult,
} from "./job-handlers";
import { serverObservability } from "./observability-runtime";

const serverConfig = parseServerConfig();

const DEFAULT_CLAIM_LIMIT = 100;

/**
 * Per-schedule dispatch budget — a handler (or the trigger enqueue) that
 * outlives it is reported `{ok:false, error:"timeout"}` and the tick moves
 * on. The raced work is NOT cancelled (JS can't interrupt a pending
 * promise), so a timed-out handler may still finish in the background —
 * fine, handlers are idempotent by contract.
 */
export const JOB_HANDLER_TIMEOUT_MS = 60_000;

/**
 * Platform-level schedules registered lazily on the first tick — upserted by
 * deterministic `platform:` id so restarts and races stay idempotent.
 * `rate-limit.prune` prunes expired buckets hourly at :17 past (off the top
 * of the hour to dodge the cron herd);
 * `connected-account.token-sweep` refreshes OAuth tokens nearing expiry —
 * its worst case (~50 sequential refreshes) bounds the cadence to ≥5 min;
 * `webhook.delivery-sweep` retries due webhook deliveries — it ticks every
 * minute because the first retry delay is 60s;
 * `push.receipts` reconciles recorded Expo send tickets every 30 minutes —
 * receipts lag sends by minutes and tickets expire after 24h.
 */
export const PLATFORM_SCHEDULES: readonly DrizzleScheduleInput[] = Object.freeze([
  Object.freeze({
    cron: "17 * * * *",
    id: "platform:rate-limit.prune",
    input: {},
    type: "rate-limit.prune",
    workspaceId: null,
  }),
  Object.freeze({
    cron: "*/30 * * * *",
    id: "platform:push.receipts",
    input: {},
    type: "push.receipts",
    workspaceId: null,
  }),
  Object.freeze({
    cron: "*/5 * * * *",
    id: "platform:connected-account.token-sweep",
    input: {},
    type: "connected-account.token-sweep",
    workspaceId: null,
  }),
  Object.freeze({
    cron: "* * * * *",
    id: "platform:webhook.delivery-sweep",
    input: {},
    type: "webhook.delivery-sweep",
    workspaceId: null,
  }),
]);

export type SchedulerTickItemResult = Readonly<{
  /** Generic static reason — internals never reach the wire shape. */
  error?: string;
  /** Cron occurrences this claim counted as missed — the delta folded into the row's cumulative missedRuns (0 for an on-time fire). */
  missedDelta: number;
  scheduleId: string;
  ok: boolean;
}>;

export type SchedulerTickResult = Readonly<{
  /** Rows claimed (locked + advanced) this tick. */
  claimed: number;
  /** Present and true when the tick only previewed — nothing was written or dispatched. */
  dryRun?: boolean;
  /** Dispatches that threw or returned `{ok:false}`. */
  failed: number;
  /** Per-claimed-row outcome, in claim order — the endpoint's `{claimed, results}` payload. */
  results: readonly SchedulerTickItemResult[];
  /** Schedules dispatched successfully — run inline (local) or enqueued (trigger). */
  ran: number;
}>;

export interface SchedulerRuntimeDependencies {
  readonly captureException?: (
    error: unknown,
    context: Readonly<{
      correlationId?: string;
      operation: string;
      scheduleId?: string;
      workspaceId: string;
    }>,
  ) => void;
  /** Max rows claimed per tick (default 100; bounded by MAX_CLAIM_LIMIT). */
  readonly claimLimit?: number;
  /** Per-item dispatch budget — defaults to {@link JOB_HANDLER_TIMEOUT_MS}. */
  readonly handlerTimeoutMs?: number;
  readonly platformSchedules?: readonly DrizzleScheduleInput[];
  readonly runHandler?: (
    type: string,
    input: unknown,
    ctx: JobHandlerContext,
  ) => Promise<JobHandlerResult>;
  readonly scheduler: Pick<DrizzleJobScheduler, "claimDueSchedules" | "upsertSchedule">;
  /** Present → dispatch claimed schedules to the `job.run` Trigger.dev task. */
  readonly triggerClient?: Pick<TriggerWorkflowClient, "triggerWorkflow">;
}

export interface SchedulerRuntime {
  /** Idempotent per runtime — the first call seeds, later calls share the memo. */
  ensurePlatformSchedules(): Promise<void>;
  tickScheduler(input?: {
    /** Preview only: skip seeding + dispatch and claim without advancing rows. */
    dryRun?: boolean;
    limit?: number;
    now?: Date;
  }): Promise<SchedulerTickResult>;
}

/**
 * One scheduler tick: seed platform schedules, atomically claim due rows
 * (claim-then-advance under FOR UPDATE SKIP LOCKED), then dispatch each — a
 * `job.run` Trigger.dev task when the jobs provider is `trigger`, the local
 * handler registry inline otherwise. A single bad schedule never aborts the
 * tick: per-schedule failures are captured and counted.
 */
export function createSchedulerRuntime(deps: SchedulerRuntimeDependencies): SchedulerRuntime {
  const scheduler = deps.scheduler;
  const claimLimit = deps.claimLimit ?? DEFAULT_CLAIM_LIMIT;
  const handlerTimeoutMs = deps.handlerTimeoutMs ?? JOB_HANDLER_TIMEOUT_MS;
  const platformSchedules = deps.platformSchedules ?? PLATFORM_SCHEDULES;
  const runHandler = deps.runHandler ?? runJobHandler;
  const capture = (
    error: unknown,
    context: Readonly<{
      correlationId?: string;
      operation: string;
      scheduleId?: string;
      workspaceId: string;
    }>,
  ) => {
    (deps.captureException ?? defaultCaptureException)(
      error instanceof Error ? error : new Error("Scheduler tick failed."),
      context,
    );
  };

  let seeded: Promise<void> | null = null;
  const ensurePlatformSchedules = (): Promise<void> => {
    seeded ??= (async () => {
      for (const schedule of platformSchedules) {
        await scheduler.upsertSchedule(schedule);
      }
    })().catch((error: unknown) => {
      // Reset the memo so the next tick retries a partial seed.
      seeded = null;
      throw error;
    });
    return seeded;
  };

  /**
   * Races one dispatch against the per-item timeout — a hung handler or a
   * wedged enqueue can't stall the rest of the tick. The losing promise is
   * left running (there is no cancellation); its late completion is
   * harmless because handlers are idempotent.
   */
  const withTimeout = <T>(work: Promise<T>, timeoutValue: T): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(timeoutValue), handlerTimeoutMs);
      // A still-pending timer must not keep the process alive once the
      // work side of the race has already settled.
      timer.unref?.();
    });
    return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
  };

  const dispatch = async (schedule: ClaimedCronSchedule, correlationId: string): Promise<void> => {
    // Claimed rows always carry the post-claim lastRunAt (the claim stamps
    // it) — it IS the fire time the idempotency key is built from.
    const firedAt = schedule.lastRunAt!;
    const request: TriggerWorkflowRequest = {
      options: {
        // Stable per claimed fire — a retried enqueue of the same claim
        // dedupes to one Trigger.dev run.
        idempotencyKey: `${schedule.id}:${firedAt.getTime()}`,
      },
      payload: {
        correlationId,
        firedAt: firedAt.toISOString(),
        input: schedule.input,
        scheduleId: schedule.id,
        type: schedule.type,
        workspaceId: schedule.workspaceId,
      },
      taskIdentifier: JOB_RUN_TASK_ID,
    };
    await deps.triggerClient!.triggerWorkflow(request);
  };

  /**
   * One schedule's dispatch → its tick-item result. Never throws: thrown
   * errors and timeouts are captured and reported per row so one poisoned
   * schedule can't abort the tick.
   */
  const dispatchOne = async (schedule: ClaimedCronSchedule): Promise<SchedulerTickItemResult> => {
    // One corr_ id per dispatched fire — carried into the job.run payload
    // (trigger path) or the handler ctx (local path), and into any dispatch
    // failure capture so the error joins the run it tried to start.
    const correlationId = newCorrelationId();
    const context = {
      correlationId,
      operation: "scheduler.dispatch",
      scheduleId: schedule.id,
      workspaceId: schedule.workspaceId ?? "platform",
    } as const;
    try {
      if (deps.triggerClient !== undefined) {
        if (!isJobHandlerRegistered(schedule.type)) {
          capture(new Error("No handler is registered for this job type."), context);
          return {
            error: "Unknown job type.",
            missedDelta: schedule.missedDelta,
            ok: false,
            scheduleId: schedule.id,
          };
        }
        const enqueued = await withTimeout(
          dispatch(schedule, correlationId).then(() => true as const),
          false as const,
        );
        if (!enqueued) {
          capture(new Error("Schedule dispatch timed out."), context);
          return {
            error: "timeout",
            missedDelta: schedule.missedDelta,
            ok: false,
            scheduleId: schedule.id,
          };
        }
      } else {
        const result = await withTimeout(
          runHandler(schedule.type, schedule.input, {
            correlationId,
            // Post-claim lastRunAt is always set — it is the fire time.
            now: schedule.lastRunAt!,
            scheduleId: schedule.id,
            workspaceId: schedule.workspaceId,
          }),
          { error: "timeout", ok: false } satisfies JobHandlerResult,
        );
        if (!result.ok) {
          if (result.error === "timeout") {
            capture(new Error("Schedule handler timed out."), context);
          }
          return {
            error: result.error,
            missedDelta: schedule.missedDelta,
            ok: false,
            scheduleId: schedule.id,
          };
        }
      }
      return { missedDelta: schedule.missedDelta, ok: true, scheduleId: schedule.id };
    } catch (error) {
      capture(error, context);
      return {
        error: "Dispatch failed.",
        missedDelta: schedule.missedDelta,
        ok: false,
        scheduleId: schedule.id,
      };
    }
  };

  return Object.freeze({
    ensurePlatformSchedules,

    async tickScheduler(input: { dryRun?: boolean; limit?: number; now?: Date } = {}) {
      const now = input.now ?? new Date();
      const dryRun = input.dryRun === true;

      if (!dryRun) {
        try {
          await ensurePlatformSchedules();
        } catch (error) {
          // A failed seed must not starve already-claimed work.
          capture(error, { operation: "scheduler.seed", workspaceId: "platform" });
        }
      }

      const claimed = await scheduler.claimDueSchedules({
        ...(dryRun ? { dryRun: true } : {}),
        limit: input.limit ?? claimLimit,
        now,
      });

      for (const schedule of claimed) {
        // A claimed row whose stored cron produced no next run was parked
        // (next_run_at → NULL) — report it so the dead schedule isn't silent.
        // Its fire still dispatches below; parking only stops future claims.
        if (schedule.nextRunAt === null) {
          capture(new Error("Schedule parked: its cron produced no next run."), {
            operation: "scheduler.park",
            scheduleId: schedule.id,
            workspaceId: schedule.workspaceId ?? "platform",
          });
        }
      }

      if (dryRun) {
        return {
          claimed: claimed.length,
          dryRun: true,
          failed: 0,
          ran: 0,
          results: claimed.map((schedule) => ({
            missedDelta: schedule.missedDelta,
            ok: true,
            scheduleId: schedule.id,
          })),
        };
      }

      let results: SchedulerTickItemResult[];
      if (deps.triggerClient !== undefined) {
        // Trigger-mode dispatch is a thin enqueue — bounded by the claim
        // limit (≤500), so it runs concurrently and allSettled keeps one
        // failed enqueue from aborting the batch.
        const settled = await Promise.allSettled(claimed.map((schedule) => dispatchOne(schedule)));
        results = settled.map((outcome, index) =>
          outcome.status === "fulfilled"
            ? outcome.value
            : {
                // dispatchOne never rejects — this is only the defensive arm.
                error: "Dispatch failed.",
                missedDelta: claimed[index]!.missedDelta,
                ok: false,
                scheduleId: claimed[index]!.id,
              },
        );
      } else {
        // Local handlers run inline and stay sequential — a bounded,
        // predictable tick cost instead of a burst of parallel work.
        results = [];
        for (const schedule of claimed) {
          results.push(await dispatchOne(schedule));
        }
      }

      const ran = results.filter((result) => result.ok).length;
      return {
        claimed: claimed.length,
        failed: results.length - ran,
        ran,
        results,
      };
    },
  });
}

function defaultCaptureException(
  error: Error,
  context: Readonly<{
    correlationId?: string;
    operation: string;
    scheduleId?: string;
    workspaceId: string;
  }>,
): void {
  serverObservability.captureException(error, context);
}

let runtime: SchedulerRuntime | null = null;

function getSchedulerRuntime(): SchedulerRuntime {
  if (runtime === null) {
    const jobsConfig = serverConfig.providers.jobs;
    let triggerClient: TriggerWorkflowClient | undefined;
    if (jobsConfig.kind === "trigger") {
      // Same SDK bootstrap the provider composition performs for JOB_PROVIDER=trigger.
      configure({ accessToken: jobsConfig.secretKey });
      triggerClient = new TriggerWorkflowClient({ tasks });
    }
    runtime = createSchedulerRuntime({
      scheduler: createDrizzleJobScheduler(database),
      ...(triggerClient === undefined ? {} : { triggerClient }),
    });
  }
  return runtime;
}

/** Tick entrypoint for the internal endpoint and the `scheduler.tick` task. */
export async function tickScheduler(input?: {
  dryRun?: boolean;
  limit?: number;
  now?: Date;
}): Promise<SchedulerTickResult> {
  return getSchedulerRuntime().tickScheduler(input);
}

/** Registers the kit's platform schedules; safe to call on every boot/tick. */
export async function ensurePlatformSchedules(): Promise<void> {
  return getSchedulerRuntime().ensurePlatformSchedules();
}
