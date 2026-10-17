import { task } from "@trigger.dev/sdk";

import { parseJobRunTaskPayload, runJobHandler } from "../src/job-handlers";

/**
 * Executes one claimed schedule. `tickScheduler` enqueues with an
 * idempotencyKey of `<scheduleId>:<firedAt-epoch>`, so a retried dispatch
 * collapses to one run; handlers are idempotent by contract. `runJobHandler`
 * never throws — unknown types and handler failures land in observability and
 * come back `{ok:false}`, so the run result itself records the outcome.
 */
export const jobRunTask = task({
  id: "job.run",
  run: async (payload: unknown) => {
    const parsed = parseJobRunTaskPayload(payload);
    return runJobHandler(parsed.type, parsed.input, {
      // Carried from the tick's dispatch; absent on legacy envelopes —
      // runJobHandler mints a fresh one rather than failing the run.
      ...(parsed.correlationId === undefined ? {} : { correlationId: parsed.correlationId }),
      now: parsed.firedAt,
      scheduleId: parsed.scheduleId,
      workspaceId: parsed.workspaceId,
    });
  },
});
