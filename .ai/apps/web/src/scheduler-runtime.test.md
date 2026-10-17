# apps/web/src/scheduler-runtime.test.ts

> Last updated: 2026-10-03 | Protection: STANDARD

## Purpose

Composition coverage for `scheduler-runtime.ts`.

## Coverage

- `PLATFORM_SCHEDULES` — seeds `rate-limit.prune`, the token sweep, and
  `webhook.delivery-sweep` (every-minute cron pinned) as platform
  schedules.
- `ensurePlatformSchedules` — upserts every platform schedule once per
  runtime (memoized); retries seeding after a failure.
- `tickScheduler` local provider — claims due schedules, runs each
  handler inline at fire time, counts `{ok:false}` results as failures
  without aborting; each dispatched run gets its own minted `corr_`
  correlationId on the handler ctx (distinct per schedule).
- `tickScheduler` trigger provider — the `job.run` payload carries
  `correlationId` alongside `firedAt`/`input`/`scheduleId`/`type`/
  `workspaceId`.
- Trigger dispatch — unknown types fail before `triggerWorkflow` is called.
- `SchedulerTickItemResult.missedDelta` — every item result reports the
  claim's `missedDelta`, including dryRun previews; the `claimed()`
  helper builds `ClaimedCronSchedule` rows (`missedDelta`/`missedRuns`
  defaulting to 0).
- The `runHandler` spy types its params (`type`, `input`, `ctx:
  JobHandlerContext`) so `mock.calls` expose the per-dispatch ctx.
- The `serverObservability` stub mirrors the full runtime shape
  (`alert`/`captureException`/`logger`/`measure`/`track`) — a partial mock
  explodes with a confusing swallowed error the moment a code path
  touches an unmocked member.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-02 | `claimed()` → `ClaimedCronSchedule`; result assertions += `missedRuns`; +delta-carrying and dryRun cases | Devin |
| 2026-10-03 | Result assertions renamed `missedRuns` → `missedDelta` (row cumulative stays `missedRuns`) | Devin |
| 2026-09-29 | `serverObservability` stub filled out to the full runtime shape (`alert`/`logger`/`measure` added) for mock fidelity | Devin |
| 2026-09-29 | Correlation-id assertions on local ctx + trigger payload; `runHandler` mock param-typed for ctx access | Devin |
| 2026-09-27 | +`webhook.delivery-sweep` schedule assertions | Devin |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |

Release verification: express the handler spy signature as a Vitest generic so call arguments remain typed without unused implementation parameters.
