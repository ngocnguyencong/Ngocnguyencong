import type * as jobs from "@supastack/jobs";
import { MAX_WORKSPACE_SCHEDULES, WorkspaceScheduleLimitError } from "@supastack/jobs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const dependencies = vi.hoisted(() => ({
  audit: vi.fn(async () => {}),
  manager: { userId: "user_1", workspaceId: "ws_1" } as
    { userId: string; workspaceId: string } | { error: string },
  revalidatePath: vi.fn(),
  scheduler: {
    claimDueSchedules: vi.fn(async () => []),
    listSchedules: vi.fn(async () => []),
    removeSchedule: vi.fn(async () => {}),
    upsertSchedule: vi.fn(async (input: Record<string, unknown>) => ({
      cron: input.cron,
      enabled: input.enabled,
      id: "sch_1",
      input: null,
      lastRunAt: null,
      nextRunAt: new Date("2026-03-05T00:00:00.000Z"),
      type: input.type,
      workspaceId: input.workspaceId,
    })),
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: dependencies.revalidatePath }));
vi.mock("./auth-runtime", () => ({ database: {} }));
vi.mock("./audit-runtime", () => ({ recordAuditEvent: dependencies.audit }));
vi.mock("./observability-runtime", () => ({
  serverObservability: { captureException: vi.fn(), track: vi.fn() },
}));
vi.mock("./workspace-access", () => ({
  requireWorkspaceManager: vi.fn(async () => dependencies.manager),
}));
vi.mock("@supastack/jobs", async (importOriginal) => {
  const original = await importOriginal<typeof jobs>();
  return {
    ...original,
    createDrizzleJobScheduler: vi.fn(() => dependencies.scheduler),
  };
});

import { removeScheduleAction, upsertScheduleAction } from "./schedule-actions";

beforeEach(() => {
  dependencies.manager = { userId: "user_1", workspaceId: "ws_1" };
  dependencies.audit.mockClear();
  dependencies.revalidatePath.mockClear();
  dependencies.scheduler.upsertSchedule.mockReset().mockImplementation(async (input) => ({
    cron: input.cron,
    enabled: input.enabled,
    id: "sch_1",
    input: null,
    lastRunAt: null,
    nextRunAt: new Date("2026-03-05T00:00:00.000Z"),
    type: input.type,
    workspaceId: input.workspaceId,
  }));
  dependencies.scheduler.listSchedules.mockReset().mockImplementation(async () => []);
  dependencies.scheduler.removeSchedule.mockClear();
});

describe("upsertScheduleAction", () => {
  it("rejects platform job types for workspace schedules", async () => {
    for (const type of [
      "connected-account.token-sweep",
      "rate-limit.prune",
      "scheduler.ping",
      // Case-normalized: a mixed-case platform type is still a platform type.
      "Rate-Limit.Prune",
    ]) {
      const result = await upsertScheduleAction({ cron: "* * * * *", type });
      expect(result.error).toContain("reserved for platform jobs");
    }
    expect(dependencies.scheduler.upsertSchedule).not.toHaveBeenCalled();
    expect(dependencies.audit).not.toHaveBeenCalled();
  });

  it("rejects malformed crons and types before touching the store", async () => {
    expect(
      (await upsertScheduleAction({ cron: "not a cron", type: "email.digest" })).error,
    ).toContain("valid five-field cron");
    expect((await upsertScheduleAction({ cron: "* * * * *", type: "bad type!" })).error).toContain(
      "job type",
    );
    expect(dependencies.scheduler.upsertSchedule).not.toHaveBeenCalled();
  });

  it("rejects unknown tenant handlers and sub-hour schedules before the store", async () => {
    expect(
      (await upsertScheduleAction({ cron: "0 * * * *", type: "unknown.tenant-job" })).error,
    ).toContain("registered");
    expect(
      (await upsertScheduleAction({ cron: "*/15 * * * *", type: "email.digest" })).error,
    ).toContain("hourly");
    expect(dependencies.scheduler.upsertSchedule).not.toHaveBeenCalled();
  });

  it("enforces the distinct schedule quota before store writes", async () => {
    dependencies.scheduler.listSchedules.mockResolvedValue(
      Array.from({ length: MAX_WORKSPACE_SCHEDULES }, (_, index) => ({
        type: `existing.${index}`,
      })) as never,
    );

    const result = await upsertScheduleAction({ cron: "0 * * * *", type: "email.digest" });

    expect(result.error).toContain(String(MAX_WORKSPACE_SCHEDULES));
    expect(dependencies.scheduler.upsertSchedule).not.toHaveBeenCalled();
    expect(dependencies.audit).not.toHaveBeenCalled();
  });

  it("surfaces a concurrent quota race from the durable scheduler", async () => {
    dependencies.scheduler.upsertSchedule.mockRejectedValue(new WorkspaceScheduleLimitError());

    const result = await upsertScheduleAction({ cron: "0 * * * *", type: "email.digest" });

    expect(result.error).toContain(String(MAX_WORKSPACE_SCHEDULES));
    expect(dependencies.audit).not.toHaveBeenCalled();
  });

  it("distinguishes an unschedulable cron — rejected enabled, pre-staged disabled", async () => {
    // "0 0 30 2 *" (Feb 30) parses but never fires.
    const enabled = await upsertScheduleAction({
      cron: "0 0 30 2 *",
      type: "email.digest",
    });
    expect(enabled.error).toContain("never fires");
    expect(dependencies.scheduler.upsertSchedule).not.toHaveBeenCalled();

    const staged = await upsertScheduleAction({
      cron: "0 0 30 2 *",
      enabled: false,
      type: "email.digest",
    });
    expect(staged.error).toBeUndefined();
    expect(dependencies.scheduler.upsertSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });

  it("normalizes the job type to lowercase and audits the upsert", async () => {
    const result = await upsertScheduleAction({ cron: "0 9 * * 1-5", type: "Email.DIGEST" });
    expect(result.error).toBeUndefined();
    expect(dependencies.scheduler.upsertSchedule).toHaveBeenCalledWith({
      cron: "0 9 * * 1-5",
      enabled: true,
      type: "email.digest",
      workspaceId: "ws_1",
    });
    expect(dependencies.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "schedule.upserted", targetId: "email.digest" }),
    );
  });

  it("surfaces the manager gate error", async () => {
    dependencies.manager = { error: "Owner or admin role required." };
    const result = await upsertScheduleAction({ cron: "* * * * *", type: "email.digest" });
    expect(result.error).toBe("Owner or admin role required.");
    expect(dependencies.scheduler.upsertSchedule).not.toHaveBeenCalled();
  });
});

describe("removeScheduleAction", () => {
  it("removes a workspace schedule and audits the removal", async () => {
    const form = new FormData();
    form.set("scheduleId", "sch_1");
    await removeScheduleAction(form);
    expect(dependencies.scheduler.removeSchedule).toHaveBeenCalledWith({
      scheduleId: "sch_1",
      workspaceId: "ws_1",
    });
    expect(dependencies.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "schedule.removed", targetId: "sch_1" }),
    );
  });
});
