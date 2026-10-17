import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./auth-runtime", () => ({ database: {} }));

// Full serverObservability shape — a partial stub explodes with a confusing
// swallowed error the moment a code path touches a member that isn't mocked.
const dependencies = vi.hoisted(() => ({
  alert: vi.fn(),
  captureException: vi.fn(),
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  measure: vi.fn((_name: string, fn: () => Promise<unknown>) => fn()),
  track: vi.fn(),
}));
vi.mock("./observability-runtime", () => ({
  serverObservability: {
    alert: dependencies.alert,
    captureException: dependencies.captureException,
    logger: dependencies.logger,
    measure: dependencies.measure,
    track: dependencies.track,
  },
}));

import type { ClaimedCronSchedule } from "@supastack/jobs";

import type { JobHandlerContext } from "./job-handlers";
import {
  createSchedulerRuntime,
  PLATFORM_SCHEDULES,
  type SchedulerRuntimeDependencies,
} from "./scheduler-runtime";

const NOW = new Date("2026-03-04T09:00:00.000Z");

function claimed(overrides: Partial<ClaimedCronSchedule> = {}): ClaimedCronSchedule {
  return {
    cron: "* * * * *",
    enabled: true,
    id: "sch_1",
    input: { a: 1 },
    lastRunAt: NOW,
    missedDelta: 0,
    missedRuns: 0,
    nextRunAt: new Date("2026-03-04T09:01:00.000Z"),
    type: "email.digest",
    workspaceId: "ws_1",
    ...overrides,
  };
}

function createDeps() {
  return {
    captureException: vi.fn(),
    runHandler: vi.fn<
      (type: string, input: unknown, ctx: JobHandlerContext) => Promise<{ ok: true }>
    >(async () => ({ ok: true })),
    scheduler: {
      claimDueSchedules: vi.fn(async () => [] as ClaimedCronSchedule[]),
      upsertSchedule: vi.fn(async (input: { id?: string }) => ({ ...input }) as never),
    },
    triggerClient: { triggerWorkflow: vi.fn(async () => ({ id: "run_1" })) },
  };
}

/** Local branch — no triggerClient. */
function localRuntime(
  deps: ReturnType<typeof createDeps>,
  extra: Partial<SchedulerRuntimeDependencies> = {},
) {
  return createSchedulerRuntime({
    captureException: deps.captureException,
    runHandler: deps.runHandler,
    scheduler: deps.scheduler,
    ...extra,
  });
}

/** Trigger branch — triggerClient present. */
function triggerRuntime(
  deps: ReturnType<typeof createDeps>,
  extra: Partial<SchedulerRuntimeDependencies> = {},
) {
  return createSchedulerRuntime({
    captureException: deps.captureException,
    runHandler: deps.runHandler,
    scheduler: deps.scheduler,
    triggerClient: deps.triggerClient,
    ...extra,
  });
}

beforeEach(() => {
  dependencies.alert.mockReset();
  dependencies.captureException.mockReset();
  dependencies.logger.error.mockReset();
  dependencies.logger.info.mockReset();
  dependencies.logger.warn.mockReset();
  dependencies.measure
    .mockReset()
    .mockImplementation((_name: string, fn: () => Promise<unknown>) => fn());
  dependencies.track.mockReset();
});

describe("PLATFORM_SCHEDULES", () => {
  it("seeds the rate-limit prune, token sweep, and webhook delivery sweep as platform schedules", () => {
    const ids = PLATFORM_SCHEDULES.map((schedule) => schedule.id);
    expect(ids).toContain("platform:rate-limit.prune");
    expect(ids).toContain("platform:connected-account.token-sweep");
    expect(ids).toContain("platform:webhook.delivery-sweep");
    for (const schedule of PLATFORM_SCHEDULES) {
      expect(schedule.workspaceId).toBeNull();
      expect(schedule.id).toMatch(/^platform:/);
    }
  });

  it("runs the webhook delivery sweep every minute (first retry delay is 60s)", () => {
    const sweep = PLATFORM_SCHEDULES.find((schedule) => schedule.type === "webhook.delivery-sweep");
    expect(sweep).toEqual(
      expect.objectContaining({
        cron: "* * * * *",
        input: {},
        workspaceId: null,
      }),
    );
  });
});

describe("ensurePlatformSchedules", () => {
  it("upserts every platform schedule once per runtime (memoized)", async () => {
    const deps = createDeps();
    const runtime = localRuntime(deps);

    await runtime.ensurePlatformSchedules();
    await runtime.ensurePlatformSchedules();

    expect(deps.scheduler.upsertSchedule).toHaveBeenCalledTimes(PLATFORM_SCHEDULES.length);
    const ids = deps.scheduler.upsertSchedule.mock.calls.map(([input]) => input.id);
    expect(ids).toEqual(PLATFORM_SCHEDULES.map((schedule) => schedule.id));
  });

  it("retries seeding after a failure", async () => {
    const deps = createDeps();
    deps.scheduler.upsertSchedule
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValue({} as never);
    const runtime = localRuntime(deps);

    await expect(runtime.ensurePlatformSchedules()).rejects.toThrow("db down");
    await expect(runtime.ensurePlatformSchedules()).resolves.toBeUndefined();
  });
});

describe("tickScheduler — local provider", () => {
  it("claims due schedules and runs each handler inline at the fire time", async () => {
    const deps = createDeps();
    deps.scheduler.claimDueSchedules.mockResolvedValue([
      claimed(),
      claimed({ id: "sch_2", type: "rate-limit.prune", workspaceId: null }),
    ]);
    const runtime = localRuntime(deps);

    const result = await runtime.tickScheduler({ now: NOW });

    expect(result).toEqual({
      claimed: 2,
      failed: 0,
      ran: 2,
      results: [
        { scheduleId: "sch_1", ok: true, missedDelta: 0 },
        { scheduleId: "sch_2", ok: true, missedDelta: 0 },
      ],
    });
    expect(deps.runHandler).toHaveBeenCalledTimes(2);
    expect(deps.runHandler).toHaveBeenNthCalledWith(
      1,
      "email.digest",
      { a: 1 },
      {
        correlationId: expect.stringMatching(/^corr_[0-9a-f-]{36}$/),
        now: NOW,
        scheduleId: "sch_1",
        workspaceId: "ws_1",
      },
    );
    expect(deps.runHandler).toHaveBeenNthCalledWith(
      2,
      "rate-limit.prune",
      { a: 1 },
      {
        correlationId: expect.stringMatching(/^corr_[0-9a-f-]{36}$/),
        now: NOW,
        scheduleId: "sch_2",
        workspaceId: null,
      },
    );
    // Each dispatched schedule gets its own correlation id.
    const firstCtx = deps.runHandler.mock.calls[0]![2];
    const secondCtx = deps.runHandler.mock.calls[1]![2];
    expect(firstCtx.correlationId).not.toBe(secondCtx.correlationId);
    expect(deps.triggerClient.triggerWorkflow).not.toHaveBeenCalled();
  });

  it("counts {ok:false} handler results as failures without aborting", async () => {
    const deps = createDeps();
    deps.scheduler.claimDueSchedules.mockResolvedValue([claimed(), claimed({ id: "sch_2" })]);
    deps.runHandler
      .mockResolvedValueOnce({ error: "Unknown job type.", ok: false } as never)
      .mockResolvedValueOnce({ ok: true });
    const runtime = localRuntime(deps);

    const result = await runtime.tickScheduler({ now: NOW });
    expect(result).toEqual({
      claimed: 2,
      failed: 1,
      ran: 1,
      results: [
        { scheduleId: "sch_1", ok: false, error: "Unknown job type.", missedDelta: 0 },
        { scheduleId: "sch_2", ok: true, missedDelta: 0 },
      ],
    });
  });

  it("captures a thrown handler dispatch and keeps ticking", async () => {
    const deps = createDeps();
    deps.scheduler.claimDueSchedules.mockResolvedValue([claimed(), claimed({ id: "sch_2" })]);
    deps.runHandler.mockRejectedValueOnce(new Error("handler exploded"));
    const runtime = localRuntime(deps);

    const result = await runtime.tickScheduler({ now: NOW });
    expect(result).toEqual({
      claimed: 2,
      failed: 1,
      ran: 1,
      results: [
        { scheduleId: "sch_1", ok: false, error: expect.any(String), missedDelta: 0 },
        { scheduleId: "sch_2", ok: true, missedDelta: 0 },
      ],
    });
    expect(deps.captureException).toHaveBeenCalledOnce();
  });

  it("times out a hanging handler per item and keeps ticking", async () => {
    const deps = createDeps();
    deps.scheduler.claimDueSchedules.mockResolvedValue([claimed(), claimed({ id: "sch_2" })]);
    deps.runHandler
      // A handler that never resolves must not stall the rest of the tick.
      .mockImplementationOnce(() => new Promise<{ ok: true }>(() => {}))
      .mockResolvedValueOnce({ ok: true });
    const runtime = localRuntime(deps, { handlerTimeoutMs: 25 });

    const result = await runtime.tickScheduler({ now: NOW });
    expect(result).toEqual({
      claimed: 2,
      failed: 1,
      ran: 1,
      results: [
        { scheduleId: "sch_1", ok: false, error: "timeout", missedDelta: 0 },
        { scheduleId: "sch_2", ok: true, missedDelta: 0 },
      ],
    });
    expect(deps.captureException).toHaveBeenCalledOnce();
  });

  it("reports a claimed schedule whose cron produced no next run (parked)", async () => {
    const deps = createDeps();
    deps.scheduler.claimDueSchedules.mockResolvedValue([
      claimed({ nextRunAt: null }),
      claimed({ id: "sch_2" }),
    ]);
    const runtime = localRuntime(deps);

    const result = await runtime.tickScheduler({ now: NOW });
    // The parked row still fired once — parking only stops future claims.
    expect(result).toMatchObject({ claimed: 2, failed: 0, ran: 2 });
    expect(deps.captureException).toHaveBeenCalledOnce();
    const [error, context] = deps.captureException.mock.calls[0]!;
    expect((error as Error).message).toMatch(/park|cron/i);
    expect(context).toMatchObject({ scheduleId: "sch_1", workspaceId: "ws_1" });
  });

  it("carries the claim's missed-occurrence delta on each item result", async () => {
    const deps = createDeps();
    deps.scheduler.claimDueSchedules.mockResolvedValue([
      claimed({ missedDelta: 3, missedRuns: 7 }),
      claimed({ id: "sch_2", missedDelta: 1, missedRuns: 1 }),
    ]);
    const runtime = localRuntime(deps);

    const result = await runtime.tickScheduler({ now: NOW });
    expect(result.results).toEqual([
      { scheduleId: "sch_1", ok: true, missedDelta: 3 },
      { scheduleId: "sch_2", ok: true, missedDelta: 1 },
    ]);
  });
});

describe("tickScheduler — dryRun", () => {
  it("previews the due set without seeding, mutating, or dispatching", async () => {
    const deps = createDeps();
    deps.scheduler.claimDueSchedules.mockResolvedValue([claimed(), claimed({ id: "sch_2" })]);
    const runtime = localRuntime(deps);

    const result = await runtime.tickScheduler({ dryRun: true, now: NOW });

    expect(result).toEqual({
      claimed: 2,
      dryRun: true,
      failed: 0,
      ran: 0,
      results: [
        { scheduleId: "sch_1", ok: true, missedDelta: 0 },
        { scheduleId: "sch_2", ok: true, missedDelta: 0 },
      ],
    });
    // A dry run performs no writes at all — platform seeding is skipped too.
    expect(deps.scheduler.upsertSchedule).not.toHaveBeenCalled();
    expect(deps.scheduler.claimDueSchedules).toHaveBeenCalledWith({
      dryRun: true,
      limit: 100,
      now: NOW,
    });
    expect(deps.runHandler).not.toHaveBeenCalled();
    expect(deps.triggerClient.triggerWorkflow).not.toHaveBeenCalled();
  });

  it("previews missed-run deltas without dispatching", async () => {
    const deps = createDeps();
    deps.scheduler.claimDueSchedules.mockResolvedValue([claimed({ missedDelta: 5 })]);
    const runtime = localRuntime(deps);

    const result = await runtime.tickScheduler({ dryRun: true, now: NOW });
    expect(result.results).toEqual([{ scheduleId: "sch_1", ok: true, missedDelta: 5 }]);
    expect(deps.runHandler).not.toHaveBeenCalled();
  });
});

describe("tickScheduler — trigger provider", () => {
  it("enqueues job.run tasks with a stable idempotency key instead of running inline", async () => {
    const deps = createDeps();
    deps.scheduler.claimDueSchedules.mockResolvedValue([claimed()]);
    const runtime = triggerRuntime(deps);

    const result = await runtime.tickScheduler({ now: NOW });

    expect(result).toEqual({
      claimed: 1,
      failed: 0,
      ran: 1,
      results: [{ scheduleId: "sch_1", ok: true, missedDelta: 0 }],
    });
    expect(deps.runHandler).not.toHaveBeenCalled();
    expect(deps.triggerClient.triggerWorkflow).toHaveBeenCalledWith({
      options: { idempotencyKey: `sch_1:${NOW.getTime()}` },
      payload: {
        correlationId: expect.stringMatching(/^corr_[0-9a-f-]{36}$/),
        firedAt: NOW.toISOString(),
        input: { a: 1 },
        scheduleId: "sch_1",
        type: "email.digest",
        workspaceId: "ws_1",
      },
      taskIdentifier: "job.run",
    });
  });

  it("fails unknown handler types before provider enqueue", async () => {
    const deps = createDeps();
    deps.scheduler.claimDueSchedules.mockResolvedValue([
      claimed({ id: "sch_unknown", type: "unknown.tenant-job" }),
    ]);
    const runtime = triggerRuntime(deps);

    const result = await runtime.tickScheduler({ now: NOW });

    expect(result).toMatchObject({ claimed: 1, failed: 1, ran: 0 });
    expect(result.results[0]).toMatchObject({ ok: false, error: "Unknown job type." });
    expect(deps.triggerClient.triggerWorkflow).not.toHaveBeenCalled();
    expect(deps.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ operation: "scheduler.dispatch", scheduleId: "sch_unknown" }),
    );
  });

  it("captures enqueue failures per schedule and continues", async () => {
    const deps = createDeps();
    deps.scheduler.claimDueSchedules.mockResolvedValue([claimed(), claimed({ id: "sch_2" })]);
    deps.triggerClient.triggerWorkflow
      .mockRejectedValueOnce(new Error("trigger down"))
      .mockResolvedValueOnce({ id: "run_2" });
    const runtime = triggerRuntime(deps);

    const result = await runtime.tickScheduler({ now: NOW });
    expect(result).toEqual({
      claimed: 2,
      failed: 1,
      ran: 1,
      results: [
        { scheduleId: "sch_1", ok: false, error: expect.any(String), missedDelta: 0 },
        { scheduleId: "sch_2", ok: true, missedDelta: 0 },
      ],
    });
    expect(deps.captureException).toHaveBeenCalledOnce();
  });

  it("times out a hanging trigger enqueue per item", async () => {
    const deps = createDeps();
    deps.scheduler.claimDueSchedules.mockResolvedValue([claimed(), claimed({ id: "sch_2" })]);
    deps.triggerClient.triggerWorkflow
      .mockImplementationOnce(() => new Promise<{ id: string }>(() => {}))
      .mockResolvedValueOnce({ id: "run_2" });
    const runtime = triggerRuntime(deps, { handlerTimeoutMs: 25 });

    const result = await runtime.tickScheduler({ now: NOW });
    expect(result).toEqual({
      claimed: 2,
      failed: 1,
      ran: 1,
      results: [
        { scheduleId: "sch_1", ok: false, error: "timeout", missedDelta: 0 },
        { scheduleId: "sch_2", ok: true, missedDelta: 0 },
      ],
    });
    expect(deps.captureException).toHaveBeenCalledOnce();
  });

  it("enqueues claimed schedules concurrently in trigger mode", async () => {
    const deps = createDeps();
    deps.scheduler.claimDueSchedules.mockResolvedValue([
      claimed(),
      claimed({ id: "sch_2" }),
      claimed({ id: "sch_3" }),
    ]);
    // Both enqueues start before either resolves — allSettled batching.
    let resolveSecond!: (value: { id: string }) => void;
    const gate = new Promise<{ id: string }>((resolve) => {
      resolveSecond = resolve;
    });
    let calls = 0;
    deps.triggerClient.triggerWorkflow.mockImplementation(() => {
      calls += 1;
      return calls === 2 ? gate : Promise.resolve({ id: `run_${calls}` });
    });
    const runtime = triggerRuntime(deps);

    const ticking = runtime.tickScheduler({ now: NOW });
    // Let the seed/claim await chain drain — all three enqueues must have
    // fired before the second one resolves, proving they ran concurrently.
    await new Promise((resolve) => setImmediate(resolve));
    expect(deps.triggerClient.triggerWorkflow).toHaveBeenCalledTimes(3);
    resolveSecond({ id: "run_2" });
    const result = await ticking;
    expect(result).toMatchObject({ claimed: 3, failed: 0, ran: 3 });
  });
});

describe("tickScheduler — seeding", () => {
  it("registers platform schedules before claiming", async () => {
    const deps = createDeps();
    const runtime = localRuntime(deps);
    await runtime.tickScheduler({ now: NOW });
    expect(deps.scheduler.upsertSchedule).toHaveBeenCalledTimes(PLATFORM_SCHEDULES.length);
  });

  it("captures a seeding failure and still claims due work", async () => {
    const deps = createDeps();
    deps.scheduler.upsertSchedule.mockRejectedValue(new Error("db down"));
    deps.scheduler.claimDueSchedules.mockResolvedValue([claimed()]);
    const runtime = localRuntime(deps);

    const result = await runtime.tickScheduler({ now: NOW });
    expect(result).toEqual({
      claimed: 1,
      failed: 0,
      ran: 1,
      results: [{ scheduleId: "sch_1", ok: true, missedDelta: 0 }],
    });
    expect(deps.captureException).toHaveBeenCalledOnce();
  });
});
