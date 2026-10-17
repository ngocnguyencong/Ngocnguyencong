# apps/web/src/ai-task-bff.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

In-process BFF for durable AI tasks: `create` (same-origin check →
session or explicit `caller` identity → workspace context + entitlement
gate → idempotency-key validation → existing-submission lookup →
submission rate limit → optional metered-quota consume → `task_run`
record/reserve → `ai_task_submitted` track → enqueue → provider run
metadata) and `read` (identity → workspace context → workspace-scoped
`readTaskResult`).

## Important Notes

- `create`/`read` accept an optional `AiTaskCaller`
  (`{ userId, workspaceId }`). When present, `getSession` is skipped
  entirely and `findWorkspaceContext(userId, workspaceId)` pins the
  membership lookup to that workspace — the /api/v1 layer passes this
  for `sk_` API-key callers; the dashboard route still relies on cookie
  `getSession`.
- A resolved context whose `workspaceId` differs from `caller.workspaceId`
  is treated as a dependency bug and rejected (403 `workspaceUnavailable`
  on create, 404 on read) — fail closed.
- `isSameOrigin` runs before any identity work on `create`; the v1
  runtime supplies a server-controlled `origin`, so the invariant holds
  uniformly for both caller shapes.
- Deterministic `taskId` (`sha256(workspaceId, idempotencyKey)`) +
  `reserveTaskRun`/`readSubmission` make submissions durable across
  ambiguous enqueue outcomes; `resume: true` re-uses the stored
  server-owned input, never a client replacement.
- `correlationId` (`corr_<uuid>`) is minted once per accepted intake and
  lands in `task_run.input`, the enqueue payload (`input.correlationId`),
  the `ai_task_submitted` track event, and the `reportMetadataFailure`
  diagnostic input — one id joins request → durable task → worker run.
  Replays/resumes reuse the stored id read back via `readSubmission` so the
  rebuilt durable input satisfies `reserveTaskRun`'s exact jsonb equality
  (semantic, not byte-level); a stored row WITHOUT one (pre-correlation
  legacy) keeps its input unchanged — the fresh id rides the enqueue
  payload only, never breaking exact-match idempotency.
- A `reserveTaskRun` miss is re-verified once via `readSubmission` before
  declaring 409: two in-flight submissions sharing a key both read null,
  mint DIFFERENT correlation ids, and the loser's input can never equal
  the winner's stored jsonb — `isSameSubmissionInput` substitutes the
  stored row's own id into the comparison (`jsonEquals` = key-order-free
  structural compare). A match resolves as the stored row and adopts its
  correlationId for downstream emits; a real mismatch still 409s.
- `reserveTaskRun` + `readSubmission` are a coupled pair (documented on
  the dependency contract): reserve-without-read turns every replay of a
  correlation-bearing row into a false 409. Production wires both.
- Optional `track?(event)` dep emits `ai_task_submitted`
  `{correlationId, taskId}` after the durable write is accepted (covers
  both the 201 and ambiguous 202 exits); emit failures are swallowed —
  telemetry must not fail an accepted submission.
- Optional `consumeTaskQuota?({taskId, workspaceId})` dep sits inside the
  same new-submission gate as the rate check — idempotent replays and
  resumes skip it, so a stored submission is charged exactly once. A
  denied consume returns 429 `quotaExceeded`. Production wires it to
  `consumeQuota` (plan `usageLimits` first, prepaid-credit overflow
  after); absent = unmetered intake.

## Open Threads / Resume Context

- Task creation passes `"write"` to the workspace-context resolver; task reads use its default read access. Keep this distinction when changing key-backed or session-backed task paths.

- `Retry-After`/`retryAfterSeconds` on the 429 envelope — the v1 BFF
  contract is `{body,status}` only; no header channel exists yet to carry
  the limiter's computed retry hint to HTTP callers.

## Bug Fixes

| Date | Bug | Cause | Fix |
| --- | --- | --- | --- |
| 2026-09-27 | `sk_` API-key callers could never create/read tasks | `create`/`read` re-derived identity via `getSession` (cookies only); the v1 runtime forwarded client headers including a spoofable `origin` | Optional `AiTaskCaller` param bypasses session lookup; `findWorkspaceContext` pins the caller's workspace |

## Change History


| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Optional `consumeTaskQuota` dep — metered quota consume for new submissions only; denied → 429 `quotaExceeded` | Devin |
| 2026-09-29 | Same-request race fix: a `reserveTaskRun` miss re-reads via `readSubmission` and re-verifies with the stored row's correlationId substituted (`isSameSubmissionInput`/`jsonEquals`) — racing identical submissions resolve 201 instead of a false 409; dep-coupling invariant documented; "byte-match" wording corrected to semantic jsonb equality | Devin |
| 2026-09-29 | Request correlation: `correlationId` minted/reused per submission (durable input + enqueue payload + `ai_task_submitted` + `reportMetadataFailure`); legacy rows keep unchanged input on replay | Devin |
| 2026-09-27 | Purpose flow += existing-submission lookup + submission rate limit | Devin |
| 2026-09-27 | Created — explicit-caller path + workspace-scoped `findWorkspaceContext` | Devin |

## Security Fix (2026-09-27)

Create checks a user/workspace submission rate before recording or enqueueing a
new durable task. Dashboard, REST v1, and MCP use this shared boundary; a denied
new request returns 429. Existing idempotency keys are looked up first, so
queued-task recovery remains available when the new-task limit is exhausted;
`reserveTaskRun` still rejects a different payload under the same key.
