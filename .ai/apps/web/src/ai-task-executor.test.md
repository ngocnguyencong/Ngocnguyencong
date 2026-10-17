# apps/web/src/ai-task-executor.test.ts

> Last updated: 2026-09-29 | Protection: STANDARD

## Purpose

Unit tests for `createProductionAiTaskExecutor`: payload/envelope
validation (including the optional `correlationId` pass-through and its
drop-if-malformed leniency), `task_run` claim + completed-replay
semantics, per-attempt budget authorization, usage/result persistence,
reservation settlement and release, completion-email recovery, the
`onTaskCompleted` correlationId fan-out, and error normalization to
`AiTaskExecutionError`.

## Important Notes

- `createDependencies` wires a real `ModelRouter` over `FakeAiProvider`
  with deterministic `now`/`createId` (`run_123`) and `vi.fn`
  repositories; reservation ids therefore render as
  `ai_budget:task_123:run_123:{attempt}`.
- Reservation-leak coverage: multi-attempt success releases the earlier
  hold at `0n` while settling the winner at real cost; router-throw and
  `appendAiUsage`-throw paths release at `0n`; `persistTaskResult`
  failure/non-completed keeps the winner at the appended real cost; a
  winner settle that rejects once is retried by the catch at real cost
  (never `0n`); a failing release is swallowed while the run still
  throws `AiTaskExecutionError`.
- Retry coverage: injected per-run `createId` nonces (`run_a`/`run_b`)
  prove two sequential `run()` calls for one `taskId` issue distinct
  reservation ids — defense-in-depth only: the mocked
  `markTaskRunRunning` re-claim is unreachable in production since
  `markTaskRunRunning` gates on `status='queued'` and nothing re-queues
  a `task_run` today.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-29 | `onTaskCompleted` fan-out cases: payload `correlationId` forwarded, omitted when absent | Devin |
| 2026-09-29 | `correlationId` optional-field parse coverage (string kept; 42/""/whitespace/null dropped; absent → undefined) | Devin |
| 2026-09-27 | Settle-rejects-once real-cost retry coverage; unreachable-in-production note on retry test | Devin |
| 2026-09-27 | Reservation release + per-run nonce id coverage | Devin |
| 2026-09-27 | Initial mirror | Devin |
