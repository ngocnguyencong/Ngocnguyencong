# apps/web/src/job-handlers.ts

> Last updated: 2026-09-29 | Protection: STANDARD

## Purpose

Registry of built-in job handlers executed by the scheduler (`job.run`
dispatches `type` → handler). Handlers are idempotent by contract and
never throw — outcomes return `{ok}` and failures land in observability.

## What It Does

- `JOB_RUN_TASK_ID = "job.run"` — the Trigger.dev task id for dispatched
  runs.
- `PLATFORM_JOB_TYPES` — platform-wide maintenance types
  (`connected-account.token-sweep`, `rate-limit.prune`, `scheduler.ping`,
  `webhook.delivery-sweep`) that ignore `ctx.workspaceId` by design;
  `upsertScheduleAction` rejects them for workspace schedules and the
  handlers no-op on a non-null workspaceId as defense in depth. The
  job-handlers test pins alignment with `createJobHandlers`.
- `webhook.delivery-sweep` calls `deps.deliverDueWebhookDeliveries(ctx.now)`
  — the default registry lazy-imports `./webhook-delivery` (same pattern
  as `sweepExpiringTokens`) — and reports `attempted` via `job.completed`.
- `runJobHandler(type, input, ctx)` — dispatch + result normalization;
  `parseJobRunTaskPayload` validates task payloads (`type` is bounded by
  the `job_schedule.type` contract — `JOB_TYPE_MAX_LENGTH`=64 +
  `JOB_TYPE_PATTERN`, since it flows verbatim into alert message/context;
  optional `correlationId` carried through, malformed values dropped).
- Handler dispatch uses an own-key lookup (`Object.hasOwn(handlers, type)`)
  — a plain `handlers[type]` would resolve inherited Object members like
  `toString`/`constructor` into a silent `{ok:true}` no-op.
- `JobHandlerContext.correlationId?` — opaque `corr_<uuid>` minted per
  dispatch by the scheduler tick; `runJobHandler` mints a fresh one when
  absent OR malformed (blank/oversized values are replaced, not
  propagated) and hands the effective ctx to the handler so
  `job.completed` properties, the failure `captureException` extra, and
  the alert all share one id.
- Failure paths (unknown type AND handler throw) now fire
  `serverObservability.alert({name: "job.failed", severity: "warning"})`
  — transient per-fire failure, so not `critical`; that tier stays
  reserved for terminal states (e.g. exhausted delivery retries)
  alongside `captureException` — message is the stable template
  `Job <type> failed for workspace <id>` (NEVER `error.message`: the alert
  body is sent verbatim and errors may carry secrets); context carries
  `{correlationId, jobType, scheduleId, workspaceId}`.
- `email.digest` — workspace job registered directly on
  `mutableJobHandlers` (lazy `import("./digest-job")`). Workspace-scoped by
  contract: NOT in `PLATFORM_JOB_TYPES` (so `upsertScheduleAction` allows
  it) and NOT wrapped in `platformOnly` — the null-workspaceId guard lives
  inside the handler itself. Emails the workspace's recently published
  content entries to its members.
- `isTenantSchedulableJobType` accepts only own-key registered handlers
  outside `PLATFORM_JOB_TYPES`; public schedule actions use it before writes.
- `isJobHandlerRegistered` is also checked on Trigger dispatch, so stale or
  manually inserted unknown database rows fail before `triggerWorkflow`.

## Important Notes

- Unknown types and handler failures both come back `{ok:false}` — the
  run row records the outcome rather than throwing through Trigger.dev.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | +`push.receipts` platform type/handler — `JobHandlerDependencies.reconcilePushReceipts` (lazy `./push-receipts` import) prunes stale device tokens on schedule | Devin |
| 2026-09-29 | `isCorrelationId` now imported from `@supastack/observability` (local copy removed) | Devin |
| 2026-09-29 | Hardening: own-key handler lookup (`Object.hasOwn` — proto-member types take the unknown-type path); `parseJobRunTaskPayload` bounds `type` by the `job_schedule.type` contract (≤64 + pattern); malformed `ctx.correlationId` mints fresh instead of propagating | Devin |
| 2026-09-29 | `job.failed` severity corrected to `"warning"` (transient per-fire failure; `critical` reserved for terminal states) | Devin |
| 2026-09-29 | Request correlation + failure alerting: `JobHandlerContext`/`JobRunTaskPayload` += `correlationId?`; `runJobHandler` mints when absent, threads it into `job.completed`/`captureException`, and fires `job.failed` (warning, stable message) on unknown type and handler failure | Devin |
| 2026-09-27 | +`email.digest` workspace job on `mutableJobHandlers` (lazy `./digest-job` import) — the type `upsertScheduleAction` suggests now actually runs | Devin |
| 2026-09-27 | +`webhook.delivery-sweep` platform type/handler/`JobHandlerDependencies.deliverDueWebhookDeliveries` (lazy `./webhook-delivery` import) — the retry sweep now actually runs | Devin |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
