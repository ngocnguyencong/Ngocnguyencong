# apps/web/src/ai-task-bff.test.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Unit tests for `createAiTaskBff`: durable submission semantics
(idempotency-key validation, `reserveTaskRun` replay/conflict,
deterministic per-workspace task ids, resume using stored server-owned
input), ambiguous enqueue recovery, metadata-attach failure tolerance,
cross-origin rejection before session lookup, entitlement gating,
request-correlation id mint/reuse, and workspace-scoped reads.

## Important Notes

- The "explicit caller identity" describe covers the `AiTaskCaller`
  lane: `getSession` never invoked, `findWorkspaceContext` receives
  `(userId, workspaceId)`, same-origin and idempotency validation still
  enforced, and a context/caller workspace mismatch is rejected
  (403 create / 404 read).
- Correlation coverage: one minted `corr_<uuid>` is shared by the durable
  `task_run.input`, the enqueue payload, and `ai_task_submitted`; resume
  reuses the stored id (durable input satisfies `reserveTaskRun`'s jsonb
  equality); a legacy stored row without the field replays unchanged while
  the enqueue still carries a fresh mint. The ambiguous-enqueue test seeds
  `readSubmission` off its fake store so the replay path exercises the same
  readback the production wiring uses.
- Same-request race coverage: forced-null pre-reserve reads plus a fake
  `reserveTaskRun` store simulate two in-flight identical submissions
  minting different ids — the loser must resolve 201 against the stored
  row (re-read via `readSubmission`) and adopt the stored correlationId
  for enqueue/track, while a genuinely different payload still 409s.
- Quota coverage: a denied `consumeTaskQuota` returns 429 `quotaExceeded`
  before `recordTaskRun`/`enqueue`; replays of an existing submission
  skip the consume entirely (no double charge).

## Change History


| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | `consumeTaskQuota` cases: denied → 429 `quotaExceeded` pre-reserve; replay skips the consume | Devin |
| 2026-09-29 | +same-request-race recovery test (loser resolves stored task, not 409) + genuine-conflict still-409 guard; "byte-match" wording corrected to jsonb equality | Devin |
| 2026-09-29 | Correlation-id coverage (mint/reuse/legacy-replay) + `track` dep on the default deps factory; ambiguous-enqueue test gained `readSubmission` readback | Devin |
| 2026-09-27 | Explicit-caller coverage for the v1 API-key path | Devin |

## Security Fix (2026-09-27)

Tests assert a new request denied by the limiter returns 429 before reservation
or enqueue, while an existing queued idempotency key can resume under the same
exhausted limit.

Task creation now passes write access to workspace resolution; the test fixture asserts that access argument while reads remain read-scoped.
