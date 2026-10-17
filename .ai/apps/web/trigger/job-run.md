# apps/web/trigger/job-run.ts

> Last updated: 2026-09-29 | Protection: STANDARD

## Purpose

Trigger.dev task `job.run` — executes one claimed schedule run.

## What It Does

- `tickScheduler` enqueues with idempotencyKey
  `<scheduleId>:<firedAt-epoch>`, so a retried dispatch collapses to one
  run; handlers are idempotent by contract.
- `parseJobRunTaskPayload(payload)` → `runJobHandler(type, input, ctx)` —
  never throws: unknown types and handler failures land in observability
  and come back `{ok:false}` so the run result records the outcome.
- `parsed.correlationId` (minted at dispatch) forwards into the handler
  ctx when present; legacy envelopes lack it and `runJobHandler` mints a
  fresh one rather than failing.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-29 | `correlationId` pass-through from the dispatch payload into the handler context | Devin |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
