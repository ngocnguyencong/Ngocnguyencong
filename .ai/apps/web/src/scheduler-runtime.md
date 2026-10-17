# apps/web/src/scheduler-runtime.ts

> Last updated: 2026-10-03 | Protection: STANDARD

## Purpose

Server-only composition root for the job scheduler: binds
`createDrizzleJobScheduler` + `TriggerWorkflowClient` (`@supastack/jobs`)
to the real database and Trigger.dev credentials.

## What It Does

- Scheduler singleton: claim/complete `job_schedule` rows, compute next
  cron occurrences (`CronSchedule`, `DrizzleScheduleInput`).
- `PLATFORM_SCHEDULES` — seeded lazily on the first tick by deterministic
  `platform:` id: `rate-limit.prune` (hourly :17),
  `connected-account.token-sweep` (*/5 min), `webhook.delivery-sweep`
  (* * * * * — first webhook retry delay is 60s).
- `TriggerWorkflowClient` — enqueues `JOB_RUN_TASK_ID` runs with
  idempotency keys (`<scheduleId>:<firedAt-epoch>`) for tick → run
  handoff; `TriggerWorkflowRequest` type re-exported.
- `SchedulerTickItemResult.missedDelta` — each tick item reports the
  claim's `missedDelta` (occurrences skipped while no tick ran; 0 for an
  on-time fire), on success, failure, and dryRun results alike. (The row's
  cumulative counter stays `missedRuns` — same name, different grain.)
- Trigger-mode dispatch checks the live handler registry before enqueue;
  unknown persisted types fail the tick item without creating a provider run.
- Durable claims rank due rows by `workspace_id` and cap each tenant at ten
  claimed rows before applying the global tick limit.
- Re-exports `JOB_RUN_TASK_ID`/`runJobHandler`/`JobHandlerContext`/
  `JobHandlerResult` for the tick endpoint and task definitions.

## Important Notes

- Durable claim lives in Postgres — a down minute just delays dispatch;
  the next tick catches up.
- Each dispatched fire mints a `correlationId` (`corr_<uuid>`) in
  `dispatchOne`: it rides the `job.run` payload under `JOB_PROVIDER=trigger`
  or the `JobHandlerContext` in local mode, and also lands in the
  `scheduler.dispatch` capture context so a failed/timeout dispatch joins
  the run it tried to start.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | +`platform:push.receipts` schedule (`*/30 * * * *`) — Expo send-ticket receipt reconciliation runs every 30 minutes | Devin |
| 2026-10-02 | `SchedulerTickItemResult` += `missedRuns` (the claim's `missedDelta`) on every dispatch path incl. dryRun; dispatch helpers take `ClaimedCronSchedule` | Devin |
| 2026-10-03 | Tick item field renamed `missedRuns` → `missedDelta` so the per-claim delta can't be confused with the row's cumulative `missedRuns` | Devin |
| 2026-09-29 | Per-dispatch `correlationId` minted in `dispatchOne` → `job.run` payload (trigger), handler ctx (local), and dispatch-failure capture context | Devin |
| 2026-09-27 | +`platform:webhook.delivery-sweep` schedule (`* * * * *`) — the webhook retry sweep is now wired to run | Devin |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
