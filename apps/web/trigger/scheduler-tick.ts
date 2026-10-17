import { schedules } from "@trigger.dev/sdk";

import { tickScheduler } from "../src/scheduler-runtime";

/**
 * Declarative Trigger.dev cron (`schedules.task`, SDK 4.5.x): fires every
 * minute, and each run claims due `job_schedule` rows and enqueues `job.run`
 * tasks. The durable claim lives in Postgres, so missed minutes catch up on
 * the next run — the cadence, not the mechanism, is what this task provides.
 */
export const schedulerTickTask = schedules.task({
  cron: "*/1 * * * *",
  id: "scheduler.tick",
  run: async (payload) => tickScheduler({ now: payload.timestamp }),
});
