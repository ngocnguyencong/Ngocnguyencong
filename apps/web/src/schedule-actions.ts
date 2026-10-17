"use server";

import { revalidatePath } from "next/cache";

import {
  createDrizzleJobScheduler,
  isAtLeastHourlyCron,
  MAX_WORKSPACE_SCHEDULES,
  nextCronRun,
  parseCronExpression,
  ScheduleNotFoundError,
  WorkspaceScheduleLimitError,
} from "@supastack/jobs";

import { database } from "./auth-runtime";
import { recordAuditEvent } from "./audit-runtime";
import { isTenantSchedulableJobType, PLATFORM_JOB_TYPES } from "./job-handlers";
import { requireWorkspaceManager } from "./workspace-access";

const settingsPath = "/settings/developers";

/**
 * Durable `job_schedule` store shared with the tick runtime — upserts compute
 * `nextRunAt`, and `claimDueSchedules` is what the scheduler endpoint ticks.
 */
const scheduler = createDrizzleJobScheduler(database);

export interface WorkspaceScheduleRow {
  cron: string;
  enabled: boolean;
  id: string;
  lastRunAt: Date | null;
  /** Cumulative occurrences skipped while no tick ran — from `job_schedule.missed_runs`. */
  missedRuns: number;
  nextRunAt: Date | null;
  type: string;
}

export async function listWorkspaceSchedules(): Promise<{
  rows: WorkspaceScheduleRow[] | null;
}> {
  const context = await requireWorkspaceManager();
  if ("error" in context) {
    return { rows: null };
  }

  const rows = await scheduler.listSchedules(context.workspaceId);
  return {
    rows: rows.map((row) => ({
      cron: row.cron,
      enabled: row.enabled,
      id: row.id,
      lastRunAt: row.lastRunAt,
      missedRuns: row.missedRuns,
      nextRunAt: row.nextRunAt,
      type: row.type,
    })),
  };
}

export async function upsertScheduleAction(input: {
  cron: string;
  enabled?: boolean;
  type: string;
}): Promise<{ error?: string }> {
  const context = await requireWorkspaceManager();
  if ("error" in context) {
    return { error: context.error };
  }

  const cron = input.cron.trim();
  // Dispatch is case-sensitive — normalize so the stored type always matches
  // its registered handler key.
  const type = input.type.trim().toLowerCase();
  if (!parseCronExpression(cron).ok) {
    return { error: "Enter a valid five-field cron expression." };
  }
  if (type.length === 0 || type.length > 64 || !/^[a-z0-9._-]+$/.test(type)) {
    return { error: "Enter a job type like email.digest." };
  }
  // Confused-deputy guard: the built-in platform types run workspace-agnostic
  // maintenance and must never be claimed by a workspace-owned schedule.
  if (PLATFORM_JOB_TYPES.includes(type)) {
    return { error: `"${type}" is reserved for platform jobs.` };
  }
  if (!isTenantSchedulableJobType(type)) {
    return { error: `"${type}" is not a registered workspace job handler.` };
  }
  if (!isAtLeastHourlyCron(cron)) {
    return { error: "Workspace schedules must run hourly or less frequently." };
  }
  const enabled = input.enabled ?? true;
  // A cron that parses but has no run inside the search window is
  // unschedulable — rejected when enabled, but allowed while disabled so a
  // schedule can be pre-staged.
  if (enabled && nextCronRun(cron, new Date()) === null) {
    return { error: "That cron never fires — save it disabled to pre-stage it." };
  }

  const schedules = await scheduler.listSchedules(context.workspaceId);
  if (
    schedules.length >= MAX_WORKSPACE_SCHEDULES &&
    !schedules.some((schedule) => schedule.type === type)
  ) {
    return { error: `A workspace may have at most ${MAX_WORKSPACE_SCHEDULES} schedules.` };
  }
  try {
    await scheduler.upsertSchedule({
      cron,
      enabled,
      type,
      workspaceId: context.workspaceId,
    });
  } catch (error) {
    if (error instanceof WorkspaceScheduleLimitError) {
      return { error: `A workspace may have at most ${MAX_WORKSPACE_SCHEDULES} schedules.` };
    }
    throw error;
  }

  await recordAuditEvent({
    action: "schedule.upserted",
    targetId: type,
    targetType: "job_schedule",
    workspaceId: context.workspaceId,
  });
  revalidatePath(settingsPath);
  return {};
}

export async function removeScheduleAction(formData: FormData): Promise<void> {
  const rawId = formData.get("scheduleId");
  const scheduleId = typeof rawId === "string" ? rawId : "";
  const context = await requireWorkspaceManager();
  if ("error" in context || scheduleId === "") {
    return;
  }

  try {
    await scheduler.removeSchedule({
      scheduleId,
      workspaceId: context.workspaceId,
    });
  } catch (error) {
    // Removing an already-gone schedule is a no-op for the caller, matching
    // the previous unconditional delete; the audit row still records intent.
    if (!(error instanceof ScheduleNotFoundError)) {
      throw error;
    }
  }
  await recordAuditEvent({
    action: "schedule.removed",
    targetId: scheduleId,
    targetType: "job_schedule",
    workspaceId: context.workspaceId,
  });
  revalidatePath(settingsPath);
}
