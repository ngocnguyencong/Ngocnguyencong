# apps/web/src/transactional-mail-templates.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Static preview catalog for the local `/mail-preview` route when the
process outbox is empty — one entry per transactional template
(auth-otp, auth-magic-link, workspace-invite, ai-task-complete,
billing-payment-failed, early-access-invite).

## Important Notes

- Previews carry `lang` + `footer` (en) so the rendered preview shows
  the same localized-capable shell real sends get through
  `HtmlTemplatedEmailSender`.
- English-only by design — it is a dev preview catalog, not the send
  path; locale resolution lives in the real builders.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | +`early-access-invite` preview entry (growth module) | Devin |
| 2026-09-22 | Entries carry `lang` + `footer` for the preview shell | Devin |
