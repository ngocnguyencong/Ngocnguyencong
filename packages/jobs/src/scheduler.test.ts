import { describe, expect, it } from "vitest";

import {
  countCronRuns,
  LocalJobScheduler,
  MAX_MISSED_RUN_COUNT,
  isAtLeastHourlyCron,
  nextCronRun,
  parseCronExpression,
  type JobScheduler,
} from "./scheduler";

function scheduler(): JobScheduler {
  return new LocalJobScheduler();
}

describe("parseCronExpression", () => {
  it("accepts five-field expressions and rejects malformed input", () => {
    expect(parseCronExpression("*/15 * * * *")).toEqual({ ok: true });
    expect(parseCronExpression("0 9 * * 1-5")).toEqual({ ok: true });
    expect(parseCronExpression("0 9 * *")).toEqual({ ok: false });
    expect(parseCronExpression("99 * * * *")).toEqual({ ok: false });
    expect(parseCronExpression("")).toEqual({ ok: false });
  });
});

describe("isAtLeastHourlyCron", () => {
  it("accepts at most one selected minute per hour", () => {
    expect(isAtLeastHourlyCron("0 * * * *")).toBe(true);
    expect(isAtLeastHourlyCron("0 9 * * 1-5")).toBe(true);
    expect(isAtLeastHourlyCron("*/60 * * * *")).toBe(true);
    expect(isAtLeastHourlyCron("*/15 * * * *")).toBe(false);
    expect(isAtLeastHourlyCron("* * * * *")).toBe(false);
    expect(isAtLeastHourlyCron("not a cron")).toBe(false);
  });
});

describe("nextCronRun", () => {
  it("computes the next matching minute for step and fixed fields", () => {
    const from = new Date("2026-01-05T09:00:00Z"); // Monday
    expect(nextCronRun("*/15 * * * *", from)?.toISOString()).toBe("2026-01-05T09:15:00.000Z");
    expect(nextCronRun("0 10 * * *", from)?.toISOString()).toBe("2026-01-05T10:00:00.000Z");
    // next weekday run
    expect(nextCronRun("0 9 * * 2", from)?.toISOString()).toBe("2026-01-06T09:00:00.000Z");
    expect(nextCronRun("0 9 * *", from)).toBeNull();
  });

  it("expands a stepped single value to n-max/step (POSIX)", () => {
    // POSIX: `0/15` is shorthand for `0-59/15` → minutes {0,15,30,45}.
    expect(nextCronRun("0/15 * * * *", new Date("2026-01-05T09:02:00Z"))?.toISOString()).toBe(
      "2026-01-05T09:15:00.000Z",
    );
    expect(nextCronRun("0/15 * * * *", new Date("2026-01-05T09:15:00Z"))?.toISOString()).toBe(
      "2026-01-05T09:30:00.000Z",
    );
    expect(nextCronRun("0/15 * * * *", new Date("2026-01-05T09:45:00Z"))?.toISOString()).toBe(
      "2026-01-05T10:00:00.000Z",
    );
    // `9/2` in the hour field → hours {9,11,…,23}: from 10:00 the next run is 11:00.
    expect(nextCronRun("0 9/2 * * *", new Date("2026-01-05T10:00:00Z"))?.toISOString()).toBe(
      "2026-01-05T11:00:00.000Z",
    );
  });

  it("unions day-of-month and day-of-week when both are restricted (POSIX)", () => {
    // `0 9 1 * 1` fires at 09:00 on the 1st of each month AND every Monday.
    const monday = new Date("2026-01-05T09:00:00Z"); // Monday Jan 5
    // Next run is the next Monday — Jan 12, not Feb 1.
    expect(nextCronRun("0 9 1 * 1", monday)?.toISOString()).toBe("2026-01-12T09:00:00.000Z");
    // From Sat Jan 31, the 1st-of-month leg wins: Sun Feb 1 09:00.
    expect(nextCronRun("0 9 1 * 1", new Date("2026-01-31T09:00:00Z"))?.toISOString()).toBe(
      "2026-02-01T09:00:00.000Z",
    );
    // When only one day field is restricted it alone must match.
    expect(nextCronRun("0 9 1 * *", new Date("2026-01-31T09:00:00Z"))?.toISOString()).toBe(
      "2026-02-01T09:00:00.000Z",
    );
    expect(nextCronRun("0 9 * * 1", new Date("2026-01-31T09:00:00Z"))?.toISOString()).toBe(
      "2026-02-02T09:00:00.000Z",
    );
    // A restricted-but-full-range field still counts as restricted —
    // `*/1` in dow unions with dom={1}, so the union covers every day.
    expect(nextCronRun("0 9 1 * */1", new Date("2026-01-31T09:00:00Z"))?.toISOString()).toBe(
      "2026-02-01T09:00:00.000Z",
    );
    // Feb 30 never fires — still unschedulable under union semantics
    // (dow unrestricted → dom alone decides).
    expect(nextCronRun("0 0 30 2 *", new Date("2026-01-05T09:00:00Z"))).toBeNull();
  });
});

describe("countCronRuns", () => {
  it("counts occurrences strictly after `fromExclusive` and at or before `to`", () => {
    // Daily 09:00 — the stored occurrence Mon 09:00 is the fire itself, so
    // only Tue/Wed/Thu 09:00 count as missed when claimed Thu 12:00.
    const from = new Date("2026-01-05T09:00:00Z"); // Monday Jan 5
    expect(countCronRuns("0 9 * * *", from, new Date("2026-01-08T12:00:00Z"))).toBe(3);
    // `to` is inclusive: an occurrence exactly at `to` counts…
    expect(countCronRuns("0 9 * * *", from, new Date("2026-01-08T09:00:00Z"))).toBe(3);
    // …but one second earlier it does not.
    expect(countCronRuns("0 9 * * *", from, new Date("2026-01-08T08:59:59Z"))).toBe(2);
    // An on-time claim counts nothing past the stored occurrence.
    expect(countCronRuns("0 9 * * *", from, new Date("2026-01-05T09:00:01Z"))).toBe(0);
    expect(countCronRuns("0 9 * * *", from, from)).toBe(0);
  });

  it("counts dense schedules and honors POSIX day-field unions", () => {
    const from = new Date("2026-01-05T09:00:00Z");
    expect(countCronRuns("* * * * *", from, new Date("2026-01-05T09:03:00Z"))).toBe(3);
    // `0 9 1 * 1` = 09:00 on the 1st AND every Monday.
    expect(
      countCronRuns(
        "0 9 1 * 1",
        new Date("2026-01-31T09:00:00Z"),
        new Date("2026-02-03T00:00:00Z"),
      ),
    ).toBe(2); // Feb 1 (dom) + Feb 2 (Monday)
  });

  it("returns 0 for invalid or unschedulable expressions", () => {
    const from = new Date("2026-01-05T09:00:00Z");
    expect(countCronRuns("not a cron", from, new Date("2026-02-05T09:00:00Z"))).toBe(0);
    expect(countCronRuns("0 0 30 2 *", from, new Date("2027-01-05T09:00:00Z"))).toBe(0);
  });

  it("saturates at the limit (default MAX_MISSED_RUN_COUNT)", () => {
    const from = new Date("2026-01-05T09:00:00Z");
    expect(countCronRuns("* * * * *", from, new Date("2026-01-06T09:00:00Z"), 7)).toBe(7);
    expect(MAX_MISSED_RUN_COUNT).toBe(10_000);
    // A year's worth of minutes caps at the default bound instead of
    // walking unboundedly.
    expect(countCronRuns("* * * * *", from, new Date("2027-01-05T09:00:00Z"))).toBe(
      MAX_MISSED_RUN_COUNT,
    );
  });
});

describe("LocalJobScheduler", () => {
  it("registers a workspace-scoped schedule and lists it", async () => {
    const jobs = scheduler();
    const schedule = await jobs.upsertSchedule({
      cron: "0 * * * *",
      input: { kind: "digest" },
      type: "email.digest",
      workspaceId: "ws_1",
    });
    expect(schedule.id).toMatch(/^sch_/);
    expect(schedule.workspaceId).toBe("ws_1");
    expect(schedule.enabled).toBe(true);
    expect(schedule.nextRunAt).toBeInstanceOf(Date);

    const listed = await jobs.listSchedules("ws_1");
    expect(listed).toHaveLength(1);
    expect(await jobs.listSchedules("ws_other")).toHaveLength(0);
  });

  it("rejects invalid cron expressions and isolates removal by workspace", async () => {
    const jobs = scheduler();
    await expect(
      jobs.upsertSchedule({
        cron: "not a cron",
        input: null,
        type: "x",
        workspaceId: "ws_1",
      }),
    ).rejects.toThrow("cron");
    await expect(
      jobs.upsertSchedule({
        cron: "*/15 * * * *",
        input: null,
        type: "too.frequent",
        workspaceId: "ws_1",
      }),
    ).rejects.toThrow(/hourly/i);

    const schedule = await jobs.upsertSchedule({
      cron: "0 * * * *",
      input: null,
      type: "x",
      workspaceId: "ws_1",
    });
    await expect(
      jobs.removeSchedule({ scheduleId: schedule.id, workspaceId: "ws_other" }),
    ).rejects.toThrow();
    await jobs.removeSchedule({ scheduleId: schedule.id, workspaceId: "ws_1" });
    expect(await jobs.listSchedules("ws_1")).toHaveLength(0);
  });

  it("dedupes on (workspace, type) and normalizes the type to lowercase", async () => {
    const jobs = scheduler();
    const first = await jobs.upsertSchedule({
      cron: "0 * * * *",
      input: { v: 1 },
      type: "Email.Digest",
      workspaceId: "ws_1",
    });
    expect(first.type).toBe("email.digest");

    const second = await jobs.upsertSchedule({
      cron: "0 * * * *",
      type: "email.digest",
      workspaceId: "ws_1",
    });
    // Same (workspace, type) pair → the existing row updates in place.
    expect(second.id).toBe(first.id);
    expect(second.cron).toBe("0 * * * *");
    // `input: undefined` leaves the stored payload untouched.
    expect(second.input).toEqual({ v: 1 });
    // A different workspace keeps its own row of the same type.
    const other = await jobs.upsertSchedule({
      cron: "0 * * * *",
      input: null,
      type: "email.digest",
      workspaceId: "ws_2",
    });
    expect(other.id).not.toBe(first.id);
    expect(await jobs.listSchedules("ws_1")).toHaveLength(1);
  });

  it("honors enabled — disabled schedules skip the tick and may pre-stage unschedulable crons", async () => {
    const enqueued: string[] = [];
    const jobs = new LocalJobScheduler({
      enqueue: async (input) => {
        enqueued.push(input.type);
        return { ...input, id: "job_1", status: "queued" };
      },
      status: async () => undefined,
      cancel: async (input) => ({ ...input, id: input.jobId, status: "cancelled" }),
    });

    const disabled = await jobs.upsertSchedule({
      cron: "0 0 30 2 *", // Feb 30 — valid but never fires
      enabled: false,
      input: null,
      type: "prestaged",
      workspaceId: "ws_1",
    });
    expect(disabled.enabled).toBe(false);
    expect(disabled.nextRunAt).toBeNull();

    const enabled = await jobs.upsertSchedule({
      cron: "0 * * * *",
      input: null,
      type: "live",
      workspaceId: "ws_1",
    });
    const ran = await jobs.tick({ now: new Date(enabled.nextRunAt!.getTime() + 1) });
    expect(ran).toBe(1);
    expect(enqueued).toEqual(["live"]);

    // Enabled upserts still require a schedulable cron — and the error
    // distinguishes "never fires" from a parse failure.
    await expect(
      jobs.upsertSchedule({ cron: "0 0 30 2 *", input: null, type: "x", workspaceId: "ws_1" }),
    ).rejects.toThrow(/never fires/i);
    await expect(
      jobs.upsertSchedule({ cron: "nope", input: null, type: "x", workspaceId: "ws_1" }),
    ).rejects.toThrow(/invalid cron/i);
  });

  it("runs due schedules through the job runner on tick", async () => {
    const enqueued: string[] = [];
    const jobs = new LocalJobScheduler({
      enqueue: async (input) => {
        enqueued.push(input.type);
        return { ...input, id: "job_1", status: "queued" };
      },
      status: async () => undefined,
      cancel: async (input) => ({ ...input, id: input.jobId, status: "cancelled" }),
    });
    const schedule = await jobs.upsertSchedule({
      cron: "0 * * * *",
      input: null,
      type: "cleanup",
      workspaceId: "ws_1",
    });
    const ran = await jobs.tick({ now: new Date(schedule.nextRunAt!.getTime() + 1) });
    expect(ran).toBe(1);
    expect(enqueued).toEqual(["cleanup"]);
  });

  it("counts the skipped occurrences when a tick runs late", async () => {
    const enqueued: string[] = [];
    const jobs = new LocalJobScheduler({
      enqueue: async (input) => {
        enqueued.push(input.type);
        return { ...input, id: "job_1", status: "queued" };
      },
      status: async () => undefined,
      cancel: async (input) => ({ ...input, id: input.jobId, status: "cancelled" }),
    });
    const schedule = await jobs.upsertSchedule({
      cron: "0 9 * * *",
      input: null,
      type: "email.digest",
      workspaceId: "ws_1",
    });
    expect(schedule.missedRuns).toBe(0);

    // The stored occurrence still fires once — the three daily runs that
    // elapsed with no tick (nextRunAt < t <= now) are counted as missed.
    const now = new Date(schedule.nextRunAt!.getTime() + 3.5 * 86_400_000);
    const ran = await jobs.tick({ now });
    expect(ran).toBe(1);
    expect(enqueued).toEqual(["email.digest"]);

    const [listed] = await jobs.listSchedules("ws_1");
    expect(listed!.missedRuns).toBe(3);
    expect(listed!.lastRunAt).toEqual(now);
    expect(listed!.nextRunAt).toEqual(nextCronRun("0 9 * * *", now));

    // A second late tick accumulates on top of the recorded misses —
    // after the first advance the stored occurrence is day4 09:00, so a
    // tick at day5 21:00 skips exactly one more run (day5 09:00).
    const later = new Date(now.getTime() + 2 * 86_400_000);
    await jobs.tick({ now: later });
    const [accumulated] = await jobs.listSchedules("ws_1");
    expect(accumulated!.missedRuns).toBe(4);
  });

  it("records zero missed runs on an on-time tick and leaves disabled schedules untouched", async () => {
    const enqueued: string[] = [];
    const jobs = new LocalJobScheduler({
      enqueue: async (input) => {
        enqueued.push(input.type);
        return { ...input, id: "job_1", status: "queued" };
      },
      status: async () => undefined,
      cancel: async (input) => ({ ...input, id: input.jobId, status: "cancelled" }),
    });
    const disabled = await jobs.upsertSchedule({
      cron: "0 * * * *",
      enabled: false,
      input: null,
      type: "dormant",
      workspaceId: "ws_1",
    });
    const live = await jobs.upsertSchedule({
      cron: "0 9 * * *",
      input: null,
      type: "live",
      workspaceId: "ws_1",
    });

    // Firing one millisecond after the stored occurrence leaves nothing missed.
    const onTime = new Date(live.nextRunAt!.getTime() + 1);
    await jobs.tick({ now: onTime });
    const [ticked] = (await jobs.listSchedules("ws_1")).filter((row) => row.id === live.id);
    expect(ticked!.missedRuns).toBe(0);

    // A far-future tick fires the enabled schedule again — but never
    // wakes or counts the disabled one.
    const farFuture = new Date(onTime.getTime() + 30 * 86_400_000);
    const ran = await jobs.tick({ now: farFuture });
    expect(ran).toBe(1);
    const [untouched] = (await jobs.listSchedules("ws_1")).filter((row) => row.id === disabled.id);
    expect(untouched!.missedRuns).toBe(0);
    expect(untouched!.lastRunAt).toBeNull();
    expect(enqueued).toEqual(["live", "live"]);
  });

  it("preserves missedRuns across upserts", async () => {
    const jobs = new LocalJobScheduler({
      enqueue: async (input) => ({ ...input, id: "job_1", status: "queued" }),
      status: async () => undefined,
      cancel: async (input) => ({ ...input, id: input.jobId, status: "cancelled" }),
    });
    const seeded = await jobs.upsertSchedule({
      cron: "0 9 * * *",
      input: null,
      type: "email.digest",
      workspaceId: "ws_1",
    });
    await jobs.tick({ now: new Date(seeded.nextRunAt!.getTime() + 3.5 * 86_400_000) });

    // The (workspace, type) dedupe path updates in place and keeps the
    // cumulative counter; the explicit-id path preserves it too.
    const deduped = await jobs.upsertSchedule({
      cron: "0 10 * * *",
      input: { fresh: true },
      type: "email.digest",
      workspaceId: "ws_1",
    });
    expect(deduped.id).toBe(seeded.id);
    expect(deduped.missedRuns).toBe(3);

    const byId = await jobs.upsertSchedule({
      cron: "0 11 * * *",
      id: seeded.id,
      input: null,
      type: "email.digest",
      workspaceId: "ws_1",
    });
    expect(byId.missedRuns).toBe(3);
    const [listed] = await jobs.listSchedules("ws_1");
    expect(listed!.missedRuns).toBe(3);
  });
});
