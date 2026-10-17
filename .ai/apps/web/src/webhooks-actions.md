# apps/web/src/webhooks-actions.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Server actions for workspace webhook endpoints + deliveries (Settings →
Developers): list, create, ping, delete.

## What It Does

- `listWebhookEndpoints` / `listWebhookDeliveries` — manager-gated,
  `workspaceId`-scoped reads (deliveries newest-first, capped at 50).
- `createWebhookEndpointAction` — validates the URL via
  `isValidWebhookEndpointUrl(url, production)` (production = https +
  publicly routable host), generates a `whsec_` secret returned once,
  inserts the endpoint row, audits `webhook_endpoint.created`.
- `pingWebhookEndpointAction` — emits a `ping` event through the real
  delivery path (`emitWorkspaceEvent`) for verification.
- `deleteWebhookEndpointAction` — workspace-scoped delete + audit.

## Important Notes

- Every path goes through `requireWorkspaceManager` and filters on
  `workspaceId` — no cross-tenant reads.
- `ping` is filtered out of the subscribe list (connectivity-only event).
- The production error copy says "A **public** https:// endpoint URL" —
  registration now rejects private/link-local/intranet targets (SSRF
  guard lives in `webhooks.ts`, mirrored at delivery time).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Production URL error copy mentions "public" after SSRF tightening | Devin |
