# app/(app)/settings/developers.tsx

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

Developers section, three panes:

- **API keys** — create (name + read/write scopes + optional
  "Expires in days" input parsed by `parseApiKeyExpiryDays`) with the
  plaintext shown exactly once; list rows render `formatApiKeyMeta`
  (prefix · scopes · created · last used · expires) with revoke.
- **Webhooks** — create (https URL + event checklist, SSRF-guarded
  server-side) with the signing secret shown once, list with ping/delete,
  and a per-endpoint "Deliveries" toggle that lazily fetches
  `webhooks.deliveries` into an expanded read-only list (event type,
  `formatDeliveryMeta` attempts/HTTP line, timestamp, status badge,
  lastError). Expansion is single-panel and collapses when the endpoint
  disappears after a reload.
- **Schedules** — upsert {type, cron}, pause/resume via
  `scheduleToggleInput` + `schedules.upsert` (`enabled` flip), and remove
  rows with next-run display; paused rows carry a "paused" badge.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-13 | Create-form resets scopes to `["read"]` after success; key-name input capped at `maxLength={100}` | Devin |
| 2026-10-13 | API-keys pane += expiry-days create field and `formatApiKeyMeta` row meta | Devin |
| 2026-10-13 | Webhooks pane += expandable delivery history per endpoint | Devin |
| 2026-10-13 | Schedules pane += pause/resume toggle | Devin |
| 2026-09-28 | Created | Devin |
