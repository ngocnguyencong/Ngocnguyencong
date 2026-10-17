# apps/web/src/marketing/roadmap-items.ts

> Last updated: 2026-10-12 | Protection: STANDARD

## Purpose

Curated public roadmap data for `/roadmap`: typed `RoadmapItem` list
(`title`, `description`, `status: planned | in_progress | shipped`) plus
`ROADMAP_STATUS_ORDER`/`ROADMAP_STATUS_LABELS` and `groupRoadmapItems()`,
which buckets items shipped → in_progress → planned (dropping empty groups).

## Important Notes

- Static, curated copy only — deliberately NOT sourced from the private
  `feature_request` table; the page never queries the DB. Public entries
  are neutral and promise-free (no dates/ETAs).
- Statuses must track reality: anything shipped in the changelog (e.g.
  mobile push notifications, prepaid credits, site analytics, the public
  trust pages, `pnpm setup`, feature-tabs) belongs in `shipped`, never
  `planned`. English labels render via `ROADMAP_STATUS_LABELS`; the page
  maps `group.status` through `RESOURCE_COPY[locale].roadmap.statusLabels`.
- `groupRoadmapItems` controls section order on the page (shipped →
  in_progress → planned); descriptions stay outcome-worded.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | `Desktop update channels` -> `shipped` (WP7: `{{channel}}` endpoint token + Beta Updates menu) and `Workspace data portability` -> `shipped` (WP8: `/api/workspace/export` + Settings → General card) | Devin |
| 2026-10-16 | `Mobile receipt reconciliation` + `Mobile offline reads` -> `shipped` (WP6: push_ticket schema + reconcile job, expo-file-system offline cache across screens) | Devin |
| 2026-10-12 | Push item description += tap deep-links + `EXPO_ACCESS_TOKEN`; new shipped items for mobile content/commerce, mobile data export, and desktop auto-update/launch-at-login; "Desktop distribution polish" → `in_progress` (update path shipped); "Mobile receipt reconciliation" added as `planned` (21 items total) | Devin |
| 2026-10-12 | Six new `planned` future items — passkey/biometric sign-in, mobile offline reads, desktop update channels, localized application UI, workspace data portability, usage-based billing reporting; "Desktop distribution polish" description narrowed to signing/notarization + release automation now that the update path shipped (27 items total) | Devin |
| 2026-10-11 | Push notifications moved to `shipped`; added shipped items for feature-tabs, public trust pages, `pnpm setup`, prepaid credits, and site analytics (16 items total) | Devin |
| 2026-10-10 | Created: 10 items across all three statuses | Devin |
