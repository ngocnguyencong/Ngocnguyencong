# apps/web/src/digest-job.ts

> Last updated: 2026-09-29 | Protection: STANDARD

## Purpose

The workspace-side job the scheduler story was missing: `email.digest`
emails a workspace's recently published `content_entry` rows to its
members. `upsertScheduleAction` has always suggested `email.digest` as the
example type — this is the handler that makes it runnable. Server-only
(`server-only` guard + `database` from `auth-runtime`).

## What It Does

- `EMAIL_DIGEST_JOB_TYPE = "email.digest"` — registered in
  `job-handlers.ts`'s `mutableJobHandlers` via a lazy `import("./digest-job")`
  wrapper (same pattern as the sweep deps).
- `parseDigestInput(raw)` — validates the `job_schedule.input` payload:
  `lookbackDays` integer 1–90 (default 7), `type` through
  `normalizeContentType` (lowercased, ≤64 chars, safe alphabet) else `null`.
  Malformed input falls back to defaults — a bad stored payload must not
  poison the run, since nothing else validates `input` on the way in.
- `buildDigestMessage({entries, lookbackDays, workspaceName})` — plain-text
  `{subject, text}`: subject `Content digest — <name> (last N days)`; body
  lists `• Title (type)` lines in query order, appends ` [<key> tier]` for
  `requiredEntitlement` rows (recipients are the publishing team — gated
  entries are tagged, not filtered), excerpt line indented under its entry.
  Titles/excerpts are whitespace-collapsed (raw `excerpt` is `text` —
  internal newlines would emit unindented continuation lines) and excerpts
  cap at 200 chars + "…".
- `createEmailDigestHandler(deps)` — injectable-deps handler: null
  `workspaceId` → `log` skip + return (workspace job by contract); else
  `since = ctx.now − lookbackDays·86_400_000`, `listEntries` → empty ⇒
  `job.completed {entries:0, sent:0, failed:0}` (no `recipients` — members
  were never fetched); else `workspaceName` + `listMemberEmails` in
  parallel, then one sequential `category:"transactional"` send per member
  — per-recipient failure goes to `logError` (not `log`) and counts
  `failed` without aborting; final `job.completed {entries, recipients,
  sent, failed}` (`recipients` = fetched member count).
- `DigestEntry` carries only rendered fields: `{excerpt,
  requiredEntitlement, title, type}` — `slug`/`publishedAt` were dropped
  (never rendered; orderBy doesn't need them selected).
- `emailDigestHandler` — the registered runtime handler. Composes deps per
  fire (module load stays light; a skipped/empty run never touches provider
  composition): `listEntries` queries `contentEntry` where workspaceId +
  `status="published"` + `publishedAt IS NOT NULL` + `>= since` (+ optional
  type eq), `desc(publishedAt)`, limit 50 (`MAX_DIGEST_ENTRIES`);
  `listMemberEmails` joins `workspaceMembership ⋈ user` capped at
  `MAX_DIGEST_RECIPIENTS = 100` — sequential sends must stay inside the
  per-handler dispatch budget (`JOB_HANDLER_TIMEOUT_MS = 60s`) under
  `JOB_PROVIDER=local`; `workspaceName` selects `workspace.name`
  (null → "your workspace"); the transactional sender is built lazily on
  first send via `createServerTransactionalEmailSender(parseServerConfig()
  .providers.email)`. Log sinks: `log` → `console.log` (skip lines),
  `logError` → `console.error` (per-recipient send failures).

## Public API

`EMAIL_DIGEST_JOB_TYPE`, `DigestEntry`, `DigestInput`, `DigestMessage`,
`EmailDigestDependencies`, `DEFAULT_DIGEST_LOOKBACK_DAYS`,
`MAX_DIGEST_LOOKBACK_DAYS`, `MAX_DIGEST_ENTRIES`, `MAX_DIGEST_RECIPIENTS`,
`parseDigestInput`, `buildDigestMessage`, `createEmailDigestHandler`,
`emailDigestHandler`.

## Dependencies

- `@supastack/db` — `contentEntry`, `user`, `workspace`,
  `workspaceMembership` tables.
- `@supastack/email` — `EmailSender` type (transactional contract).
- `@supastack/observability` — `AnalyticsEvent` type.
- `@supastack/config` — `parseServerConfig` (email provider pick).
- `./auth-runtime` — `database`.
- `./content` — `normalizeContentType` (type filter normalization).
- `./job-handlers` — `JobHandler` type (type-only import).
- `./observability-runtime` — `serverObservability.track` default.
- `./server-provider-composition` — `createServerTransactionalEmailSender`
  (branded HTML wrapper around the configured provider).

## Agent Decisions

- NOT in `PLATFORM_JOB_TYPES`, NOT wrapped in `platformOnly` — this is the
  workspace-schedule exemplar; the null-`workspaceId` guard lives inside the
  handler (a platform schedule has no member list to address, so it skips).
- Sender composition deferred to first `send` — a platform skip or empty
  window never pays for (or fails on) env parsing/provider construction.
- Sends are sequential — small bounded member fan-out matching the local
  dispatch loop's sequential style; a per-recipient throw is logged via
  `logError` (no recipient identity in the line) and counted, not rethrown.
- Digest carries entry metadata only (no bodies, no links) — members get
  the title/type/tier/excerpt, not content.
- Members can't opt out individually — the digest addresses every
  workspace member by design; removing the schedule stops delivery.

## Important Notes

- `job.completed` tracking copies the `completed()` helper shape in
  `createJobHandlers`: `distinctId`/`workspaceId` = workspaceId,
  `properties` = `{entries, failed, recipients?, scheduleId, sent, type}`
  (`recipients` only on the send path — members aren't fetched when the
  window is empty) plus `correlationId` when `ctx.correlationId` is
  present (minted per dispatch; absent on legacy/manual invocations).
- `upsertScheduleAction` takes `{cron, enabled?, type}` only — schedule
  `input` is set through `upsertSchedule`'s `job_schedule.input` jsonb
  column (documented in the `modules/scheduled-digest` guide). No public
  API route accepts a schedule payload today.
- Test file mocks `./server-provider-composition` — it pulls the whole
  provider SDK graph; injected-deps tests never touch it.

## Open Threads

None.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-29 | `job.completed` properties += `ctx.correlationId` when present | Devin |
| 2026-09-27 | Review fixes: `MAX_DIGEST_RECIPIENTS` (100) bounds member fan-out; `recipients` on the send-path `job.completed`; `DigestEntry` dropped `slug`/`publishedAt`; titles/excerpts whitespace-collapsed, excerpts capped at 200 + "…"; per-recipient failures moved to `logError` (console.error) | Devin |
| 2026-09-27 | Created — `email.digest` workspace job: input parsing, message builder, injectable handler, lazy-composed runtime handler | Devin |
