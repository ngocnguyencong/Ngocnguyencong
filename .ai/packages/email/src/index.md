# packages/email/src/index.ts

> Last updated: 2026-10-05 | Protection: CRITICAL

## Purpose

Transactional-only email sender contract + adapters. `EmailSender`
boundary: `send(TransactionalEmail)` → queued `EmailDelivery`,
`getStatus` scoped by `workspaceId`. Provider adapters retain only bounded,
short-lived status metadata; the local preview outbox retains bounded and
truncated message content for development. Outreach is rejected at runtime
(`OutreachEmailRejectedError`).

## Adapters

- `LocalOutboxEmailSender` — TTL- and count-bounded in-memory dev outbox
  (`listDeliveries`); retained preview fields have explicit length limits.
- `ResendTransactionalEmailSender` — injected client + from.
- `SesTransactionalEmailSender` — SES v2 `Content.Simple` via injected client.
- `HtmlTemplatedEmailSender` — decorates any sender: renders
  `templates.ts` html when the message has none; forwards the
  message's optional `lang` + `footer` into the template so the HTML
  shell localizes (`<html lang>` + footer line).

## Important Notes / NEVER Change

- Local mail repair (2026-10-05): a `Symbol.for` slot on `globalThis` owns the
  shared outbox so separate module instances in the same process reuse queued
  deliveries. Module scope alone lost messages after reload. A real send/reload
  regression failed before the fix and passes afterward; TTL, count,
  truncation, workspace filtering, and transactional-only checks remain.
  Storage is still in memory: separate OS processes and server restarts do not
  share the buffer.
- Actual Next development bundles were checked locally: a temporary route
  queued a fictional pre-auth delivery and the separate `/mail-preview` page
  rendered it. The probe and its mirror were removed afterward.

- `TransactionalEmail` carries optional `lang`/`footer` — builders that
  resolve a request locale (`auth-otp-delivery`, `workspace-invite`)
  pass dictionary values; everything else defaults to English.
- No SDK imports or credentials in this file; composition lives in the
  app's provider-composition module.
- Provider status retention contains only delivery ID, workspace ID, and
  status; message bodies, recipient addresses, and subjects are not retained
  after `send` returns. Status entries expire and have a maximum count.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-03 | Bound local outbox retention/content and provider status metadata to reduce token retention and memory growth | Codex |
| 2026-09-22 | `lang`/`footer` on `TransactionalEmail`; decorator forwards both | Devin |
