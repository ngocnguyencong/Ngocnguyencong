import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const dependencies = vi.hoisted(() => ({
  alert: vi.fn(),
  captureException: vi.fn(),
  track: vi.fn(),
}));
vi.mock("./observability-runtime", () => ({
  serverObservability: {
    alert: dependencies.alert,
    captureException: dependencies.captureException,
    track: dependencies.track,
  },
}));
vi.mock("./auth-runtime", () => ({ database: {} }));

import {
  createJobHandlers,
  JOB_HANDLERS,
  parseJobRunTaskPayload,
  PLATFORM_JOB_TYPES,
  isTenantSchedulableJobType,
  registerJobHandler,
  runJobHandler,
  type JobHandlerContext,
} from "./job-handlers";

const CTX: JobHandlerContext = {
  now: new Date("2026-03-04T09:00:00.000Z"),
  scheduleId: "sch_1",
  workspaceId: "ws_1",
};

beforeEach(() => {
  dependencies.alert.mockReset();
  dependencies.captureException.mockReset();
  dependencies.track.mockReset();
});

describe("JOB_HANDLERS registry", () => {
  it("registers the built-in platform job types", () => {
    expect(Object.keys(JOB_HANDLERS)).toEqual(
      expect.arrayContaining([
        "rate-limit.prune",
        "connected-account.token-sweep",
        "scheduler.ping",
        "webhook.delivery-sweep",
      ]),
    );
    for (const handler of Object.values(JOB_HANDLERS)) {
      expect(handler).toEqual(expect.any(Function));
    }
  });

  it("keeps PLATFORM_JOB_TYPES aligned with the built-in handler keys", () => {
    const handlers = createJobHandlers({
      reconcilePushReceipts: async () => ({ checked: 0, expired: 0, failedChunks: 0, pruned: 0 }),
      deliverDueWebhookDeliveries: async () => ({ attempted: 0 }),
      pruneExpiredRateLimitBuckets: async () => 0,
      sweepExpiringTokens: async () => ({ failed: 0, refreshed: 0, skipped: 0 }),
    });
    expect([...PLATFORM_JOB_TYPES].sort()).toEqual(Object.keys(handlers).sort());
  });

  it("registers email.digest as a workspace job — not a platform type", () => {
    expect(JOB_HANDLERS["email.digest"]).toEqual(expect.any(Function));
    // Workspace schedules may register it; the null-workspaceId guard lives
    // inside the handler itself (see digest-job.ts), not in platformOnly.
    expect(PLATFORM_JOB_TYPES).not.toContain("email.digest");
  });

  it("recognizes only registered non-platform types as tenant-schedulable", () => {
    expect(isTenantSchedulableJobType("email.digest")).toBe(true);
    expect(isTenantSchedulableJobType("rate-limit.prune")).toBe(false);
    expect(isTenantSchedulableJobType("unknown.tenant-job")).toBe(false);
  });
});

describe("scheduler.ping handler", () => {
  it("logs one smoke-test line identifying the schedule and fire time", async () => {
    const lines: string[] = [];
    const handlers = createJobHandlers({
      reconcilePushReceipts: async () => ({ checked: 0, expired: 0, failedChunks: 0, pruned: 0 }),
      deliverDueWebhookDeliveries: async () => ({ attempted: 0 }),
      log: (line) => {
        lines.push(line);
      },
      pruneExpiredRateLimitBuckets: async () => 0,
      sweepExpiringTokens: async () => ({ failed: 0, refreshed: 0, skipped: 0 }),
    });

    await expect(
      runJobHandler("scheduler.ping", null, { ...CTX, workspaceId: null }, handlers),
    ).resolves.toEqual({ ok: true });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("scheduler.ping");
    expect(lines[0]).toContain("sch_1");
    expect(lines[0]).toContain(CTX.now.toISOString());
  });
});

describe("platform job-type guard (defense in depth)", () => {
  it.each(PLATFORM_JOB_TYPES)(
    "no-ops %s when invoked under a workspace scope and logs the skip",
    async (type) => {
      const lines: string[] = [];
      const deliveries: unknown[] = [];
      const sweeps: unknown[] = [];
      const prunes: unknown[] = [];
      const handlers = createJobHandlers({
        reconcilePushReceipts: async () => ({
          checked: 0,
          expired: 0,
          failedChunks: 0,
          pruned: 0,
        }),
        deliverDueWebhookDeliveries: async (now) => {
          deliveries.push(now);
          return { attempted: 0 };
        },
        log: (line) => {
          lines.push(line);
        },
        pruneExpiredRateLimitBuckets: async (now) => {
          prunes.push(now);
          return 0;
        },
        sweepExpiringTokens: async (input) => {
          sweeps.push(input);
          return { failed: 0, refreshed: 0, skipped: 0 };
        },
        track: dependencies.track,
      });

      // A workspace-owned schedule carrying a platform type must never reach
      // the platform-wide work — even if it slipped past upsert validation.
      await expect(runJobHandler(type, { limit: 3 }, CTX, handlers)).resolves.toEqual({
        ok: true,
      });
      expect(sweeps).toHaveLength(0);
      expect(prunes).toHaveLength(0);
      expect(deliveries).toHaveLength(0);
      expect(dependencies.track).not.toHaveBeenCalled();
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain(type);
      expect(lines[0]).toContain("ws_1");
      expect(lines[0]).toMatch(/skipped/i);
    },
  );
});

describe("registerJobHandler", () => {
  it("dispatches a newly registered type through the default registry", async () => {
    const seen: unknown[] = [];
    registerJobHandler("test.registered", async (input, ctx) => {
      seen.push(input, ctx.scheduleId);
    });

    await expect(runJobHandler("test.registered", { b: 2 }, CTX)).resolves.toEqual({ ok: true });
    expect(seen).toEqual([{ b: 2 }, "sch_1"]);
    expect(JOB_HANDLERS["test.registered"]).toEqual(expect.any(Function));
  });

  it("replaces an existing registration — last write wins", async () => {
    registerJobHandler("test.overwrite", async () => {
      throw new Error("stale handler");
    });
    registerJobHandler("test.overwrite", async () => {});

    await expect(runJobHandler("test.overwrite", null, CTX)).resolves.toEqual({ ok: true });
    expect(dependencies.captureException).not.toHaveBeenCalled();
  });

  it("rejects invalid types and non-function handlers", () => {
    for (const type of ["", "   ", "bad type!", "x".repeat(65)]) {
      expect(() => registerJobHandler(type, async () => {})).toThrow();
    }
    for (const handler of [null, undefined, 42, "fn"]) {
      expect(() => registerJobHandler("test.valid", handler as never)).toThrow();
    }
    // Failed validation must not leave registry entries behind.
    expect(JOB_HANDLERS["bad type!"]).toBeUndefined();
    expect(JOB_HANDLERS["test.valid"]).toBeUndefined();
  });
});

describe("runJobHandler", () => {
  it("returns {ok:false} and captures unknown types without throwing", async () => {
    const result = await runJobHandler("nope.unknown", null, CTX, {});
    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(dependencies.captureException).toHaveBeenCalledOnce();
    const [, context] = dependencies.captureException.mock.calls[0]!;
    expect(context).toMatchObject({ operation: "job.run", workspaceId: "ws_1" });
  });

  it("reports platform workspace for null-workspace schedules", async () => {
    await runJobHandler("nope.unknown", null, { ...CTX, workspaceId: null }, {});
    const [, context] = dependencies.captureException.mock.calls[0]!;
    expect(context).toMatchObject({ workspaceId: "platform" });
  });

  it("captures handler errors and still resolves {ok:false}", async () => {
    const handlers = {
      "x.y": async () => {
        throw new Error("boom");
      },
    };
    const result = await runJobHandler("x.y", null, CTX, handlers);
    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(dependencies.captureException).toHaveBeenCalledOnce();
  });

  it("alerts job.failed on handler failure — stable message, never error text", async () => {
    const handlers = {
      "x.y": async () => {
        throw new Error("db password hunter2 leaked");
      },
    };
    const result = await runJobHandler(
      "x.y",
      null,
      { ...CTX, correlationId: "corr_run-1" },
      handlers,
    );
    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(dependencies.alert).toHaveBeenCalledOnce();
    const [event] = dependencies.alert.mock.calls[0]!;
    expect(event).toMatchObject({ name: "job.failed", severity: "warning" });
    expect(event.message).toBe("Job x.y failed for workspace ws_1");
    expect(event.message).not.toContain("hunter2");
    expect(event.context).toMatchObject({
      correlationId: "corr_run-1",
      jobType: "x.y",
      scheduleId: "sch_1",
      workspaceId: "ws_1",
    });
    const [, context] = dependencies.captureException.mock.calls[0]!;
    expect(context).toMatchObject({ correlationId: "corr_run-1", operation: "job.run" });
  });

  it.each(["toString", "constructor", "hasOwnProperty"])(
    "treats inherited Object member type %s as unknown, not a silent no-op",
    async (type) => {
      // `handlers[type]` on a plain object resolves Object.prototype members
      // — the lookup must be own-key only or these would return {ok:true}
      // without ever running a handler.
      const result = await runJobHandler(type, null, CTX, {});
      expect(result).toEqual({ ok: false, error: "Unknown job type." });
      expect(dependencies.captureException).toHaveBeenCalledOnce();
      expect(dependencies.alert).toHaveBeenCalledOnce();
    },
  );

  it("alerts job.failed once on an unknown job type without throwing", async () => {
    const result = await runJobHandler(
      "nope.unknown",
      null,
      { ...CTX, correlationId: "corr_u1" },
      {},
    );
    expect(result).toEqual({ ok: false, error: "Unknown job type." });
    expect(dependencies.alert).toHaveBeenCalledOnce();
    const [event] = dependencies.alert.mock.calls[0]!;
    expect(event.name).toBe("job.failed");
    expect(event.severity).toBe("warning");
    expect(event.context).toMatchObject({
      correlationId: "corr_u1",
      jobType: "nope.unknown",
      scheduleId: "sch_1",
      workspaceId: "ws_1",
    });
  });

  it("mints a fresh correlationId when the ctx carries a malformed one", async () => {
    const seen: JobHandlerContext[] = [];
    const handlers = {
      "x.y": async (_input: unknown, ctx: JobHandlerContext) => {
        seen.push(ctx);
      },
    };
    await expect(
      runJobHandler("x.y", null, { ...CTX, correlationId: "" }, handlers),
    ).resolves.toEqual({ ok: true });
    // The handler must see the minted id — the blank ctx value is replaced.
    expect(seen[0]!.correlationId).toMatch(/^corr_[0-9a-f-]{36}$/);
  });

  it("mints a corr_ correlationId when the run context lacks one and threads it everywhere", async () => {
    const seen: JobHandlerContext[] = [];
    const handlers = {
      "x.y": async (_input: unknown, ctx: JobHandlerContext) => {
        seen.push(ctx);
        throw new Error("boom");
      },
    };
    await expect(runJobHandler("x.y", null, CTX, handlers)).resolves.toEqual({
      ok: false,
      error: expect.any(String),
    });
    const minted = seen[0]!.correlationId;
    expect(minted).toMatch(/^corr_[0-9a-f-]{36}$/);
    const [, context] = dependencies.captureException.mock.calls[0]!;
    expect(context).toMatchObject({ correlationId: minted });
    const [event] = dependencies.alert.mock.calls[0]!;
    expect(event.context).toMatchObject({ correlationId: minted });
  });

  it("does not alert when the handler resolves", async () => {
    const handlers = { "x.y": async () => {} };
    await expect(runJobHandler("x.y", null, CTX, handlers)).resolves.toEqual({ ok: true });
    expect(dependencies.alert).not.toHaveBeenCalled();
  });

  it("carries the run correlationId into job.completed properties", async () => {
    const handlers = createJobHandlers({
      reconcilePushReceipts: async () => ({ checked: 0, expired: 0, failedChunks: 0, pruned: 0 }),
      deliverDueWebhookDeliveries: async () => ({ attempted: 0 }),
      pruneExpiredRateLimitBuckets: async () => 3,
      sweepExpiringTokens: async () => ({ failed: 0, refreshed: 0, skipped: 0 }),
      track: dependencies.track,
    });
    await expect(
      runJobHandler(
        "rate-limit.prune",
        null,
        { ...CTX, workspaceId: null, correlationId: "corr_sch-1" },
        handlers,
      ),
    ).resolves.toEqual({ ok: true });
    expect(dependencies.track).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "job.completed",
        properties: expect.objectContaining({ correlationId: "corr_sch-1" }),
      }),
    );
  });

  it("returns {ok:true} when the handler resolves", async () => {
    const seen: unknown[] = [];
    const handlers = {
      "x.y": async (input: unknown, ctx: JobHandlerContext) => {
        seen.push(input, ctx.scheduleId);
      },
    };
    await expect(runJobHandler("x.y", { a: 1 }, CTX, handlers)).resolves.toEqual({ ok: true });
    expect(seen).toEqual([{ a: 1 }, "sch_1"]);
  });
});

describe("rate-limit.prune handler", () => {
  it("calls the real prune function with a fake store and reports the count", async () => {
    const { pruneExpiredRateLimitBuckets } = await import("@supastack/db");
    const executed: unknown[] = [];
    // postgres.js RowList duck — pruneExpiredRateLimitBuckets reads `.count`.
    const fakeStore = {
      async execute(command: unknown) {
        executed.push(command);
        return Object.assign([], { count: 7 });
      },
    };

    const handlers = createJobHandlers({
      reconcilePushReceipts: async () => ({ checked: 0, expired: 0, failedChunks: 0, pruned: 0 }),
      deliverDueWebhookDeliveries: async () => ({ attempted: 0 }),
      pruneExpiredRateLimitBuckets: (now) => pruneExpiredRateLimitBuckets(fakeStore as never, now),
      sweepExpiringTokens: async () => ({ failed: 0, refreshed: 0, skipped: 0 }),
      track: dependencies.track,
    });

    await expect(
      runJobHandler("rate-limit.prune", null, { ...CTX, workspaceId: null }, handlers),
    ).resolves.toEqual({ ok: true });
    expect(executed).toHaveLength(1);
    expect(dependencies.track).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "job.completed",
        properties: expect.objectContaining({
          deleted: 7,
          scheduleId: "sch_1",
          type: "rate-limit.prune",
        }),
        workspaceId: "platform",
      }),
    );
  });
});

describe("connected-account.token-sweep handler", () => {
  // The platform guard no-ops non-null workspaceIds — platform handlers run
  // under a null-workspace (platform schedule) context.
  const PLATFORM_CTX = { ...CTX, workspaceId: null };

  it("sweeps expiring tokens at the fire time and honors an input limit", async () => {
    const sweeps: { limit?: number; now?: Date }[] = [];
    const handlers = createJobHandlers({
      reconcilePushReceipts: async () => ({ checked: 0, expired: 0, failedChunks: 0, pruned: 0 }),
      deliverDueWebhookDeliveries: async () => ({ attempted: 0 }),
      pruneExpiredRateLimitBuckets: async () => 0,
      sweepExpiringTokens: async (input) => {
        sweeps.push(input ?? {});
        return { failed: 1, refreshed: 2, skipped: 1 };
      },
      track: dependencies.track,
    });

    await expect(
      runJobHandler("connected-account.token-sweep", { limit: 5 }, PLATFORM_CTX, handlers),
    ).resolves.toEqual({ ok: true });
    expect(sweeps).toEqual([{ limit: 5, now: CTX.now }]);
    expect(dependencies.track).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({ failed: 1, refreshed: 2, skipped: 1 }),
      }),
    );
  });

  it("ignores malformed sweep input", async () => {
    const sweeps: { limit?: number; now?: Date }[] = [];
    const handlers = createJobHandlers({
      reconcilePushReceipts: async () => ({ checked: 0, expired: 0, failedChunks: 0, pruned: 0 }),
      deliverDueWebhookDeliveries: async () => ({ attempted: 0 }),
      pruneExpiredRateLimitBuckets: async () => 0,
      sweepExpiringTokens: async (input) => {
        sweeps.push(input ?? {});
        return { failed: 0, refreshed: 0, skipped: 0 };
      },
    });
    await expect(
      runJobHandler("connected-account.token-sweep", { limit: "lots" }, PLATFORM_CTX, handlers),
    ).resolves.toEqual({ ok: true });
    expect(sweeps).toEqual([{ now: CTX.now }]);
  });
});

describe("webhook.delivery-sweep handler", () => {
  it("delivers due webhook deliveries at the fire time and reports the count", async () => {
    const calls: Date[] = [];
    const handlers = createJobHandlers({
      reconcilePushReceipts: async () => ({ checked: 0, expired: 0, failedChunks: 0, pruned: 0 }),
      deliverDueWebhookDeliveries: async (now) => {
        calls.push(now);
        return { attempted: 3 };
      },
      pruneExpiredRateLimitBuckets: async () => 0,
      sweepExpiringTokens: async () => ({ failed: 0, refreshed: 0, skipped: 0 }),
      track: dependencies.track,
    });

    await expect(
      runJobHandler("webhook.delivery-sweep", {}, { ...CTX, workspaceId: null }, handlers),
    ).resolves.toEqual({ ok: true });
    expect(calls).toEqual([CTX.now]);
    expect(dependencies.track).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "job.completed",
        properties: expect.objectContaining({
          attempted: 3,
          scheduleId: "sch_1",
          type: "webhook.delivery-sweep",
        }),
        workspaceId: "platform",
      }),
    );
  });
});

describe("push.receipts handler", () => {
  it("reconciles at the fire time and reports the outcome", async () => {
    const calls: Date[] = [];
    const handlers = createJobHandlers({
      deliverDueWebhookDeliveries: async () => ({ attempted: 0 }),
      pruneExpiredRateLimitBuckets: async () => 0,
      reconcilePushReceipts: async (now) => {
        calls.push(now);
        return { checked: 4, expired: 1, failedChunks: 0, pruned: 2 };
      },
      sweepExpiringTokens: async () => ({ failed: 0, refreshed: 0, skipped: 0 }),
      track: dependencies.track,
    });

    await expect(
      runJobHandler("push.receipts", {}, { ...CTX, workspaceId: null }, handlers),
    ).resolves.toEqual({ ok: true });
    expect(calls).toEqual([CTX.now]);
    expect(dependencies.track).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "job.completed",
        properties: expect.objectContaining({
          checked: 4,
          expired: 1,
          failedChunks: 0,
          pruned: 2,
          scheduleId: "sch_1",
          type: "push.receipts",
        }),
        workspaceId: "platform",
      }),
    );
  });
});

describe("parseJobRunTaskPayload", () => {
  it("accepts a well-formed envelope", () => {
    expect(
      parseJobRunTaskPayload({
        firedAt: "2026-03-04T09:00:00.000Z",
        input: { a: 1 },
        scheduleId: "sch_1",
        type: "rate-limit.prune",
        workspaceId: null,
      }),
    ).toEqual({
      firedAt: new Date("2026-03-04T09:00:00.000Z"),
      input: { a: 1 },
      scheduleId: "sch_1",
      type: "rate-limit.prune",
      workspaceId: null,
    });
  });

  it("carries an optional correlationId and drops malformed values", () => {
    const base = {
      firedAt: "2026-03-04T09:00:00.000Z",
      input: {},
      scheduleId: "s",
      type: "t",
      workspaceId: null,
    };
    expect(parseJobRunTaskPayload({ ...base, correlationId: "corr_1" }).correlationId).toBe(
      "corr_1",
    );
    expect(parseJobRunTaskPayload(base).correlationId).toBeUndefined();
    for (const bad of [42, "", "   ", null]) {
      expect(parseJobRunTaskPayload({ ...base, correlationId: bad }).correlationId).toBeUndefined();
    }
  });

  it.each([
    null,
    "x",
    { firedAt: "not-a-date", scheduleId: "s", type: "t", workspaceId: null },
    { firedAt: "2026-03-04T09:00:00.000Z", scheduleId: "", type: "t", workspaceId: null },
    { firedAt: "2026-03-04T09:00:00.000Z", scheduleId: "s", type: "", workspaceId: null },
    // `type` flows verbatim into the job.failed alert message + context —
    // bound by the same contract as job_schedule.type (varchar(64), pattern).
    { firedAt: "2026-03-04T09:00:00.000Z", scheduleId: "s", type: "bad type!", workspaceId: null },
    {
      firedAt: "2026-03-04T09:00:00.000Z",
      scheduleId: "s",
      type: "x".repeat(65),
      workspaceId: null,
    },
    { firedAt: "2026-03-04T09:00:00.000Z", scheduleId: "s", type: "t", workspaceId: 42 },
  ])("rejects malformed payload %j", (value) => {
    expect(() => parseJobRunTaskPayload(value)).toThrow();
  });
});
