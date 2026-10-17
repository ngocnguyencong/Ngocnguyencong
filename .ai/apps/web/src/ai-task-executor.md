# apps/web/src/ai-task-executor.ts

> Last updated: 2026-09-29 | Protection: STANDARD

## Purpose

Worker-side executor for durable AI tasks
(`createProductionAiTaskExecutor(...).run(payload)`): claims the
`task_run`, resolves the workspace AI context, drives
`ModelRouter.complete` with a `beforeProviderAttempt` hook that writes an
`ai_budget_reservation` hold per attempt, then appends `ai_usage`,
settles the winning reservation, persists the immutable result, and sends
the completion email. All failure modes collapse to
`AiTaskExecutionError` so the Trigger boundary never sees raw internals.

## What It Does

- Payload validation (`requirePayload` / `parseTriggeredAiTaskPayload`) —
  strict alias/requirements/identifier/email checks; envelope
  `workspaceId` must match the nested input. Optional `correlationId`
  (`corr_<uuid>` from intake) passes through onto
  `ProductionAiTaskPayload`; a missing or malformed value is dropped, not
  fatal — the runtime mints a fresh one before emitting.
- Replay guard — `readTaskResult` short-circuits to `completeNotification`
  when already `completed`; `markTaskRunRunning` claim must return
  `running` or the run aborts without re-executing.
- `beforeProviderAttempt` — estimates cost via `calculateModelCost` and
  calls `authorizeAiProviderAttempt` with reservation id
  `ai_budget:{taskId}:{runNonce}:{attemptNumber}`; `runNonce` comes from
  `dependencies.createId("run")` once per `run()`. Non-`authorized`
  statuses (`budget_exceeded`, `entitlement_required`) fail the attempt;
  `onBudgetExceeded` fires best-effort for `budget_exceeded`.
- Reservation ledger — every authorized id is tracked in
  `authorizedReservationIds`; `settledReservationIds` records settled
  ones. Success path settles the winning id at the real
  `completion.usage.costMicrounits` (throwing, as before), then releases
  every earlier hold via `releaseReservation(id, 0n, completedAt)` — a
  0n settle flips the row off `reserved`, dropping the monthly hold.
  Failure path (`!taskCompleted` catch) releases all unsettled holds
  best-effort; the winning id keeps the real cost when
  `appendedUsageCostMicrounits` is set (usage row already persisted) so
  the ledger stays consistent.
- Usage/result persistence — `appendAiUsage` writes `usage_{taskId}`
  attributed to `successfulReservationAt`; `persistTaskResult` must
  return `completed` or the run fails; `onTaskCompleted` (input now
  carries `correlationId?` — the payload's intake id — beside
  `taskId`/`workspaceId`, so the emit chain stays on the request's id)
  and `completeNotification` (delivery-id `email_delivery_{taskId}`,
  skips already-accepted/delivered rows) finish the run.
- Failure path — `markTaskRunFailed(errorCode: "ai_execution_failed")`
  best-effort, then `AiTaskExecutionError`.

## Important Notes

- `releaseReservation` is best-effort per id — a settle failure is
  swallowed so it can never mask the run's own error, and the
  `settledReservationIds` guard prevents double-settling.
- BYOK workspaces with a null monthly budget authorize without a reservation.
  Platform-funded workspaces without an explicit limit use the finite default.
- `appendedUsageCostMicrounits` is only assigned after `appendAiUsage`
  resolves, so releases on the failure path use 0n unless the usage row
  genuinely exists.
- The per-run nonce is defense-in-depth, not a fix for a reachable
  collision: `markTaskRunRunning` only claims `status='queued'` rows and
  nothing returns a `task_run` to `queued`, so a retried run can never
  actually re-authorize today — but if a future path re-queues, fresh
  ids avoid colliding on `settled` reservation rows.
- Accepted residual: a worker crash (or process kill) between
  authorization and the failure catch leaves its holds `reserved` until
  the billing month rolls over — reservations have no TTL or reaper yet.
- The failure catch hoists `failedAt = dependencies.now()` once so every
  release and `markTaskRunFailed` share one consistent failure instant.
- `safeTokenNumber` guards provider token counts against the Postgres
  integer range before persistence; exported so the synchronous chat path
  (`chat-budget.ts`) clamps through the same helper.
- `estimateConservativeUsage` is exported for the synchronous chat budget
  path so both routes use the same input/output estimate.
- Dependencies are injected (`repositories`, `router`, `email`,
  `createId`, `now`, `resolveWorkspaceAiContext`,
  `onBudgetExceeded`/`onTaskCompleted`) — the composition root lives in
  `ai-task-runtime.ts`.

## Bug Fixes

| Date | Bug | Cause | Fix |
| --- | --- | --- | --- |
| 2026-09-27 | `ai_budget_reservation` holds leaked forever on retry/failure, shrinking the workspace's monthly budget until `budget_exceeded` lockout | Only the last authorized reservation was settled, and only on the success path; earlier router-retry holds and every post-authorization failure path left rows `reserved` with no TTL | Track all authorized ids and best-effort release (settle `0n`) the unsettled ones on both success and failure paths; keep the winning hold at real cost when the usage row persisted |
| 2026-09-27 | Reservation ids were `ai_budget:{taskId}:{attemptNumber}` — stable across runs, so any path that ever re-authorizes a task would collide on the `settled` row ("cannot be reused") | Latent only: `markTaskRunRunning` gates on `status='queued'` and nothing re-queues today, so the collision is unreachable — hardened as defense-in-depth anyway | Per-run nonce from `createId("run")` makes ids `ai_budget:{taskId}:{runNonce}:{attemptNumber}` |

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-29 | `isCorrelationId` now imported from `@supastack/observability` (local copy removed) | Devin |
| 2026-09-29 | `onTaskCompleted` input += `correlationId?` forwarded from the task payload | Devin |
| 2026-09-29 | `ProductionAiTaskPayload` += optional `correlationId` — lenient parse (drop malformed, never fail) | Devin |
| 2026-09-27 | `safeTokenNumber` exported (shared with `chat-budget.ts`) | Devin |
| 2026-09-27 | Hoisted `failedAt` in failure catch; reframed nonce as defense-in-depth; noted crash-window residual | Devin |
| 2026-09-27 | Track + release all authorized budget reservations; per-run nonce in reservation ids | Devin |
| 2026-09-27 | Initial mirror | Devin |
