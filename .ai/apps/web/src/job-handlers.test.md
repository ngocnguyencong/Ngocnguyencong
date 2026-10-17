# apps/web/src/job-handlers.test.ts

> Last updated: 2026-09-29 | Protection: STANDARD

## Purpose

Unit coverage for `job-handlers.ts` — the built-in job handler registry.

## Coverage

- `JOB_HANDLERS` registry — registers the built-in platform types;
  `PLATFORM_JOB_TYPES` stays aligned with handler keys.
- `scheduler.ping` — logs one smoke-test line (schedule + fire time).
- `webhook.delivery-sweep` — calls the dep at the fire time and reports
  `attempted` on `job.completed`.
- Platform job-type guard — handlers no-op on a non-null workspaceId
  (defense in depth).
- `registerJobHandler` — a newly registered type dispatches through the
  default registry.
- `email.digest` — registered on `JOB_HANDLERS` as a workspace job and
  pinned OUT of `PLATFORM_JOB_TYPES`.
- Tenant schedule type policy — registered workspace handlers pass; unknown
  and platform-only handler types fail.
- Correlation + alerting — `runJobHandler` failure path asserts
  `alert({name:"job.failed", severity:"warning"})` with the stable
  `Job <type> failed for workspace <id>` message (never error text) and
  `{correlationId, jobType, scheduleId, workspaceId}` context; unknown
  type alerts once; a minted `corr_` id fills a context that lacks one
  and reaches the handler, the capture extra, and the alert; `job.completed`
  properties carry `ctx.correlationId` when present; ok runs never alert.
- `runJobHandler` edge cases — inherited Object member types
  (`toString`/`constructor`/`hasOwnProperty`) take the unknown-type path
  (own-key lookup, no silent `{ok:true}`); a blank ctx `correlationId` is
  replaced by a minted `corr_` id the handler actually sees.
- `parseJobRunTaskPayload` — optional `correlationId` passes through;
  malformed values (non-string/blank) are dropped, not rejected; `type`
  must satisfy the `job_schedule.type` contract (≤64, `[a-z0-9._-]`) or
  the whole payload is rejected.
- `serverObservability` mock = `{alert, captureException, track}` spies.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-29 | +proto-member-type unknown-path cases, malformed `type` rejection in `parseJobRunTaskPayload`, blank-ctx-correlationId mint test | Devin |
| 2026-09-29 | Alert severity assertion corrected `critical` → `warning` (transient per-fire failure) | Devin |
| 2026-09-29 | `job.failed` alert + correlation-id coverage; `alert` spy added to the `serverObservability` mock | Devin |
| 2026-09-27 | +`email.digest` registration pin (in `JOB_HANDLERS`, not in `PLATFORM_JOB_TYPES`) | Devin |
| 2026-09-27 | +`webhook.delivery-sweep` in registry expectation, guard sweep, dedicated handler test; `deliverDueWebhookDeliveries` dep added to `createJobHandlers` calls | Devin |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
