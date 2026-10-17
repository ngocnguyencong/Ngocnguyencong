# packages/email/src/index.test.ts

> Last updated: 2026-10-05 | Protection: STANDARD

## Purpose

Unit tests for the sender contract + adapters (hand-rolled `EmailApi`
type + dynamic import so the suite tolerates partial implementations).

## Coverage

- Send through the shared local sender, reload the module, and read the same
  queued message through the new module instance, with workspace filtering.
  The regression failed before process-global storage and passes after it.

- `LocalOutboxEmailSender` — queue, scoped status, outreach rejection,
  `listDeliveries` ordering/filter.
- `ResendTransactionalEmailSender` / `SesTransactionalEmailSender` —
  request mapping, outreach rejected before provider call, missing id →
  `TransactionalEmailDeliveryError`.
- `HtmlTemplatedEmailSender` — renders shell when `html` absent;
  `lang`/`footer` forwarded into the template; provided `html` untouched.
- Provider sender status maps retain only minimal status metadata and evict
  expired/old entries; local outbox expires, caps count, and truncates retained
  content while keeping newest-first preview behavior.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-03 | Add retention, expiry, and local outbox bound regressions | Codex |
| 2026-09-22 | Added HtmlTemplatedEmailSender describe incl. lang/footer forwarding | Devin |
