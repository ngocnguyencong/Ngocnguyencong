# apps/web/src/digest-job.test.ts

> Last updated: 2026-09-29 | Protection: STANDARD

## Purpose

Unit coverage for `digest-job.ts` — the `email.digest` workspace job.
Pure/injected-deps style: `createEmailDigestHandler` takes all I/O as
deps, so only module-load boundaries are mocked.

## Coverage

- `parseDigestInput` — `{}`/non-object/non-record → `{lookbackDays: 7,
  type: null}`; valid `{lookbackDays, type}` honored (1 and 90 inclusive);
  out-of-range/non-integer/non-number lookback → default; `type`
  normalized through `normalizeContentType` (lowercased, safe alphabet,
  ≤64) else null.
- `buildDigestMessage` — subject `Content digest — <name> (last N days)`
  (`last day` singular at 1); `• Title (type)` lines preserve entry order;
  `requiredEntitlement` appends ` [<key> tier]`; excerpt line indented
  directly under its entry; ungated/excerpt-less entries emit no extras;
  whitespace in titles/excerpts collapses to single spaces (multi-line
  excerpts stay one indented line), excerpts cap at 200 chars + "…",
  whitespace-only excerpts drop entirely.
- `createEmailDigestHandler` —
  - null `workspaceId` → one skip log line (type + scheduleId), no
    `listEntries`/sends/track calls.
  - zero entries → `job.completed {entries:0, sent:0}` tracked once, no
    member/workspaceName lookups, no sends.
  - happy path → `listEntries` receives `{since = ctx.now − lookbackDays
    ·DAY_MS, type, workspaceId}`; one `category:"transactional"` send per
    member email carrying the built subject/text + workspaceId; final
    `job.completed {entries, recipients, failed:0, sent, scheduleId, type}`.
  - per-recipient send rejection → failure line on `logError` (NOT `log`),
    `failed` count, remaining sends still attempted in order.
  - `workspaceName` null → exact fallback subject `Content digest — your
    workspace (last 7 days)`.
  - `ctx.correlationId` present → `job.completed` properties carry it;
    absent → the properties omit the key entirely.
- `emailDigestHandler` — exported JobHandler; drift pin asserts
  `EMAIL_DIGEST_JOB_TYPE === "email.digest"` AND that `JOB_HANDLERS` keys
  it (registry literal ↔ export can't drift).

## Mocks

- `server-only` — stubbed.
- `./auth-runtime` — `database: {}` (handler deps are injected; the
  drizzle-backed defaults are never exercised here).
- `./observability-runtime` — `serverObservability.{track,captureException}`
  spies.
- `./server-provider-composition` — `createServerTransactionalEmailSender`
  stub returning `{send}` spy; avoids loading the provider SDK graph.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-29 | `job.completed` correlationId present/absent coverage | Devin |
| 2026-09-27 | Review-fix coverage: whitespace-collapse/excerpt-cap/whitespace-only excerpt cases; `recipients` on track asserts; failure line on `logError`; exact fallback-subject assert; `EMAIL_DIGEST_JOB_TYPE` ↔ registry-key drift pin (dynamic `./job-handlers` import) | Devin |
| 2026-09-27 | Initial — covers parseDigestInput, buildDigestMessage, createEmailDigestHandler, emailDigestHandler export | Devin |
