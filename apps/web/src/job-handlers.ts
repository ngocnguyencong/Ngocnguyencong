import "server-only";

import {
  createDrizzlePushTicketRepository,
  createDrizzlePushTokenRepository,
  pruneExpiredRateLimitBuckets,
} from "@supastack/db";
import { isCorrelationId, newCorrelationId, type AnalyticsEvent } from "@supastack/observability";

import { database } from "./auth-runtime";
import { serverObservability } from "./observability-runtime";
import { reconcilePushReceipts, type PushReceiptReconcileResult } from "./push-receipts";

/** Trigger.dev task id for dispatched schedule runs. */
export const JOB_RUN_TASK_ID = "job.run";

/**
 * The built-in job types that run platform-wide maintenance — they ignore
 * `ctx.workspaceId` by design and must never run for a workspace-owned
 * schedule. `upsertScheduleAction` rejects these for workspace schedules;
 * the handlers themselves no-op on a non-null workspaceId as defense in
 * depth. Keep in sync with the built-ins in `createJobHandlers` — the
 * job-handlers test pins the alignment.
 */
export const PLATFORM_JOB_TYPES: readonly string[] = Object.freeze([
  "connected-account.token-sweep",
  "push.receipts",
  "rate-limit.prune",
  "scheduler.ping",
  "webhook.delivery-sweep",
]);

export type JobHandlerContext = Readonly<{
  /**
   * Opaque `corr_<uuid>` minted at dispatch — joins the run's `job.completed`
   * event, failure capture, and `job.failed` alert back to the tick/enqueue
   * that produced it. `runJobHandler` mints one when absent.
   */
  correlationId?: string;
  /** The claimed fire time — the schedule's post-claim `lastRunAt`. */
  now: Date;
  scheduleId: string;
  /** `null` for platform-level schedules (job_schedule allows NULL). */
  workspaceId: string | null;
}>;

export type JobHandler = (input: unknown, ctx: JobHandlerContext) => Promise<void>;

export type JobHandlerResult = Readonly<{ ok: true }> | Readonly<{ error: string; ok: false }>;

/**
 * The `job.run` task payload — produced by `tickScheduler`, consumed by the
 * Trigger.dev `job.run` task. `firedAt` travels as ISO over the wire and is
 * parsed back into `ctx.now`.
 */
export interface JobRunTaskPayload {
  /** Minted by the tick at dispatch; absent on envelopes enqueued before correlation existed. */
  readonly correlationId?: string;
  readonly firedAt: Date;
  readonly input: unknown;
  readonly scheduleId: string;
  readonly type: string;
  readonly workspaceId: string | null;
}

export class JobRunPayloadError extends Error {
  constructor() {
    super("Malformed job.run payload.");
    this.name = "JobRunPayloadError";
  }
}

/**
 * The `job_schedule.type` contract (varchar(64), this pattern — same rules
 * `drizzle-scheduler` enforces on upsert and `registerJobHandler` enforces
 * on registration). `type` travels verbatim into alert messages and capture
 * context, so the payload parser bounds it too.
 */
const JOB_TYPE_MAX_LENGTH = 64;
const JOB_TYPE_PATTERN = /^[a-z0-9._-]+$/i;

export function parseJobRunTaskPayload(value: unknown): JobRunTaskPayload {
  if (!isRecord(value)) {
    throw new JobRunPayloadError();
  }
  const firedAt = typeof value.firedAt === "string" ? new Date(value.firedAt) : null;
  if (
    firedAt === null ||
    Number.isNaN(firedAt.getTime()) ||
    typeof value.scheduleId !== "string" ||
    value.scheduleId.length === 0 ||
    typeof value.type !== "string" ||
    value.type.length === 0 ||
    value.type.length > JOB_TYPE_MAX_LENGTH ||
    !JOB_TYPE_PATTERN.test(value.type) ||
    !(value.workspaceId === null || typeof value.workspaceId === "string")
  ) {
    throw new JobRunPayloadError();
  }
  return Object.freeze({
    // Optional and opaque: a missing or malformed value is dropped — the
    // dispatch mints a fresh id downstream rather than failing the run.
    ...(isCorrelationId(value.correlationId) ? { correlationId: value.correlationId } : {}),
    firedAt,
    input: value.input,
    scheduleId: value.scheduleId,
    type: value.type,
    workspaceId: value.workspaceId,
  });
}

export interface JobHandlerDependencies {
  deliverDueWebhookDeliveries(now: Date): Promise<{ attempted: number }>;
  /** Smoke-test log sink for `scheduler.ping` — defaults to `console.log`. */
  log?(line: string): void;
  /** Expo receipt reconciliation for recorded send tickets. */
  reconcilePushReceipts(now: Date): Promise<PushReceiptReconcileResult>;
  pruneExpiredRateLimitBuckets(now: Date): Promise<number>;
  sweepExpiringTokens(input?: {
    limit?: number;
    now?: Date;
  }): Promise<{ failed: number; refreshed: number; skipped: number }>;
  /** Completion metrics sink — defaults to `serverObservability.track`. */
  track?(event: AnalyticsEvent): void;
}

const MAX_SWEEP_LIMIT = 500;

/**
 * Builds the handler map with injectable dependencies. Handlers may throw —
 * `runJobHandler` owns the never-throw boundary.
 */
export function createJobHandlers(
  deps: JobHandlerDependencies,
): Readonly<Record<string, JobHandler>> {
  const completed = (ctx: JobHandlerContext, type: string, metrics: Record<string, unknown>) => {
    deps.track?.({
      distinctId: ctx.workspaceId ?? "platform",
      name: "job.completed",
      properties: {
        ...metrics,
        ...(ctx.correlationId === undefined ? {} : { correlationId: ctx.correlationId }),
        scheduleId: ctx.scheduleId,
        type,
      },
      workspaceId: ctx.workspaceId ?? "platform",
    });
  };

  /**
   * Defense in depth against the confused deputy: the built-ins run
   * platform-wide maintenance and must never execute under a workspace
   * schedule even if one slips past upsert validation — no-op + log instead
   * of doing platform work on a tenant's behalf.
   */
  const platformOnly = (type: string, handler: JobHandler): JobHandler => {
    return async (input, ctx) => {
      if (ctx.workspaceId !== null) {
        deps.log?.(
          `[${type}] skipped — platform job type invoked for workspaceId=${
            ctx.workspaceId
          } scheduleId=${ctx.scheduleId}`,
        );
        return;
      }
      await handler(input, ctx);
    };
  };

  return Object.freeze({
    // Platform maintenance: refresh connected-account OAuth tokens nearing
    // expiry. Worst case is ~50 sequential refreshes, so the seeded cadence
    // stays at/under five minutes and ticks must not overlap.
    "connected-account.token-sweep": platformOnly(
      "connected-account.token-sweep",
      async (input, ctx) => {
        const limit = sweepLimit(input);
        const result = await deps.sweepExpiringTokens({
          ...(limit === undefined ? {} : { limit }),
          now: ctx.now,
        });
        completed(ctx, "connected-account.token-sweep", {
          failed: result.failed,
          refreshed: result.refreshed,
          skipped: result.skipped,
        });
      },
    ),
    // Platform maintenance: reconcile recorded Expo send tickets against
    // the receipts API — prunes DeviceNotRegistered tokens and clears
    // answered/expired ticket rows.
    "push.receipts": platformOnly("push.receipts", async (_input, ctx) => {
      const result = await deps.reconcilePushReceipts(ctx.now);
      completed(ctx, "push.receipts", {
        checked: result.checked,
        expired: result.expired,
        failedChunks: result.failedChunks,
        pruned: result.pruned,
      });
    }),
    // Platform maintenance: drop expired fixed-window rate-limit buckets.
    "rate-limit.prune": platformOnly("rate-limit.prune", async (_input, ctx) => {
      const deleted = await deps.pruneExpiredRateLimitBuckets(ctx.now);
      completed(ctx, "rate-limit.prune", { deleted });
    }),
    // Smoke test: proves the claim→dispatch path end to end with one log
    // line — schedule one of these to verify a deployment's tick wiring.
    "scheduler.ping": platformOnly("scheduler.ping", async (_input, ctx) => {
      deps.log?.(
        `[scheduler.ping] scheduleId=${ctx.scheduleId} workspaceId=${
          ctx.workspaceId ?? "platform"
        } firedAt=${ctx.now.toISOString()}`,
      );
    }),
    // Platform maintenance: retry outbound webhook deliveries whose backoff
    // elapsed (plus legacy rows stuck pending with a NULL nextAttemptAt).
    "webhook.delivery-sweep": platformOnly("webhook.delivery-sweep", async (_input, ctx) => {
      const result = await deps.deliverDueWebhookDeliveries(ctx.now);
      completed(ctx, "webhook.delivery-sweep", { attempted: result.attempted });
    }),
  });
}

function sweepLimit(input: unknown): number | undefined {
  if (!isRecord(input)) {
    return undefined;
  }
  const limit = input.limit;
  return Number.isInteger(limit) && (limit as number) >= 1 && (limit as number) <= MAX_SWEEP_LIMIT
    ? (limit as number)
    : undefined;
}

/**
 * The built-in registry — mutable by design. `JOB_HANDLERS` is a read-only
 * view over this map, so `registerJobHandler` writes are visible to
 * `runJobHandler`'s default lookup at call time. Deps are lazy where the
 * underlying composition is heavy: the sweep service pulls the
 * connected-account vault/repository graph.
 */
const mutableJobHandlers: Record<string, JobHandler> = {
  ...createJobHandlers({
    async deliverDueWebhookDeliveries(now) {
      const { deliverDueWebhookDeliveries } = await import("./webhook-delivery");
      return deliverDueWebhookDeliveries(now);
    },
    // The ping handler IS a log line — console is the intended sink.
    log: (line) => console.log(line),
    pruneExpiredRateLimitBuckets: (now) => pruneExpiredRateLimitBuckets(database, now),
    reconcilePushReceipts: (now) =>
      reconcilePushReceipts(
        {
          ticketRepository: createDrizzlePushTicketRepository(database),
          tokenRepository: createDrizzlePushTokenRepository(database),
        },
        now,
      ),
    async sweepExpiringTokens(input) {
      const { sweepExpiringTokens } = await import("./connected-accounts-runtime");
      return sweepExpiringTokens(input);
    },
    track: (event) => serverObservability.track(event),
  }),
  // Workspace example: email the workspace's recently published entries to
  // its members. Workspace-scoped by contract — platform schedules (null
  // workspaceId) skip inside the handler. Kept out of PLATFORM_JOB_TYPES so
  // workspace schedules may register it.
  "email.digest": async (input, ctx) => {
    const { emailDigestHandler } = await import("./digest-job");
    await emailDigestHandler(input, ctx);
  },
};

export const JOB_HANDLERS: Readonly<Record<string, JobHandler>> = mutableJobHandlers;

/** Whether a job type currently has an own-property handler in the registry. */
export function isJobHandlerRegistered(type: string): boolean {
  return Object.hasOwn(JOB_HANDLERS, type) && typeof JOB_HANDLERS[type] === "function";
}

/** Workspace schedules may invoke registered handlers except platform-only work. */
export function isTenantSchedulableJobType(type: string): boolean {
  return isJobHandlerRegistered(type) && !PLATFORM_JOB_TYPES.includes(type);
}

/**
 * Registers (or replaces) a job-type handler — the extension point products
 * use to add their own scheduled work (derived products register their
 * handlers this way). Last write wins, so a product may deliberately
 * override a built-in.
 * `type` is validated against the scheduler's own contract so every
 * registered type remains schedulable on `job_schedule.type` (varchar 64),
 * then lowercased — schedule upserts normalize to lowercase and dispatch is
 * case-sensitive, so the registry keys must match the stored form.
 */
export function registerJobHandler(type: string, handler: JobHandler): void {
  const normalized = typeof type === "string" ? type.trim().toLowerCase() : "";
  if (
    normalized.length === 0 ||
    normalized.length > JOB_TYPE_MAX_LENGTH ||
    !JOB_TYPE_PATTERN.test(normalized)
  ) {
    throw new Error("A valid job type is required.");
  }
  if (typeof handler !== "function") {
    throw new Error("A job handler function is required.");
  }
  mutableJobHandlers[normalized] = handler;
}

class UnknownJobTypeError extends Error {
  constructor() {
    super("No handler is registered for this job type.");
    this.name = "UnknownJobTypeError";
  }
}

/**
 * Never-throw dispatch: unknown types and handler failures are captured to
 * observability and reported as `{ok:false}` so a poisoned schedule can never
 * abort a tick or crash the `job.run` task without a trace.
 */
export async function runJobHandler(
  type: string,
  input: unknown,
  ctx: JobHandlerContext,
  handlers: Readonly<Record<string, JobHandler>> = JOB_HANDLERS,
): Promise<JobHandlerResult> {
  // Dispatch-minted id preferred; absent or malformed (inline/test callers)
  // → mint here so every emit of this run shares one valid correlationId.
  // The handler sees the effective ctx so its own `job.completed` joins the
  // same chain.
  const correlationId = isCorrelationId(ctx.correlationId) ? ctx.correlationId : newCorrelationId();
  const workspaceId = ctx.workspaceId ?? "platform";
  const alertJobFailed = () => {
    serverObservability.alert({
      context: {
        correlationId,
        jobType: type,
        scheduleId: ctx.scheduleId,
        workspaceId,
      },
      // Stable, static text — never error.message (may carry secrets; the
      // alert body is sent verbatim).
      message: `Job ${type} failed for workspace ${workspaceId}`,
      name: "job.failed",
      // "warning" — a single fire failure is transient (the schedule may
      // retry next tick); "critical" stays reserved for terminal states.
      severity: "warning",
    });
  };
  // Own-key lookup — `handlers[type]` alone resolves inherited Object
  // members ("toString", "constructor") to truthy non-handlers, which would
  // silently no-op as {ok:true} instead of taking the unknown-type path.
  const handler = Object.hasOwn(handlers, type) ? handlers[type] : undefined;
  if (handler === undefined) {
    serverObservability.captureException(new UnknownJobTypeError(), {
      correlationId,
      operation: "job.run",
      scheduleId: ctx.scheduleId,
      type,
      workspaceId,
    });
    alertJobFailed();
    return { error: "Unknown job type.", ok: false };
  }
  try {
    // A malformed ctx id is replaced, not propagated — the handler always
    // sees the effective correlationId.
    await handler(input, ctx.correlationId === correlationId ? ctx : { ...ctx, correlationId });
    return { ok: true };
  } catch (error) {
    serverObservability.captureException(
      error instanceof Error ? error : new Error("Job handler failed."),
      {
        correlationId,
        operation: "job.run",
        scheduleId: ctx.scheduleId,
        type,
        workspaceId,
      },
    );
    alertJobFailed();
    return { error: "Job handler failed.", ok: false };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
