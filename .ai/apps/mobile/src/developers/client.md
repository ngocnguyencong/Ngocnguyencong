# src/developers/client.ts

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

`/api/mobile/{api-keys,webhooks,schedules,domains,audit}` — the developer
+ ops surface. Flat-payload routes (no `{data}` envelope).

## What It Does

- `createMobileDeveloperActions(api)` →
  `apiKeys.{list,create,revoke}` / `webhooks.{list,create,ping,remove,deliveries}` /
  `schedules.{list,upsert,remove}` / `domains.{list,add,refresh,remove}` /
  `audit.list`.
- `parseApiKeyExpiryDays(raw)` — "Expires in days" input → integer
  (trunc, clamp [0,3650], non-numeric/blank → 0 = never), mirroring the
  `createApiKeyAction` server clamp.
- `formatApiKeyMeta(key)` — key-row meta line
  (`prefix… · scopes · created d · last used d · expires d`; expiry
  omitted when null, `—` for dates that never happened) — mirrors the
  web keys list quiet-note.
- `scheduleToggleInput(schedule)` — pure helper building the pause/resume
  upsert input ({cron, enabled: !enabled, type}); schedules upsert by
  (workspaceId, type) so the cron must ride along.
- `formatDeliveryMeta(delivery)` — compact delivery meta line
  ("2 attempts · HTTP 500"; code omitted when the endpoint never
  answered). `webhooks.deliveries(endpointId)` returns guarded
  `WebhookDeliveryRow[]` — read-only, there is no retry endpoint.
- One-time secrets surface verbatim (`apiKeys.create.plaintext`,
  `webhooks.create.secret`) — the UI must present them once.
- `WEBHOOK_EVENT_TYPES` mirrors `WEBHOOK_EVENTS` in
  `apps/web/src/webhook-events.ts`; `API_KEY_SCOPES` mirrors
  `apps/web/src/api-keys.ts`. Keep in sync.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-13 | += `parseApiKeyExpiryDays` + `formatApiKeyMeta` (key expiry create field + created/last-used/expires row meta) | Devin |
| 2026-10-13 | += `formatDeliveryMeta` for the delivery-history list | Devin |
| 2026-10-13 | += `scheduleToggleInput` pause/resume helper | Devin |
| 2026-09-28 | Created | Devin |
