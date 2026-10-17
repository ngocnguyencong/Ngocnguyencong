# src/setup-readiness-runtime.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Server-only snapshot collector for `/setup` — `collectSetupSnapshot()`
reads `parseServerConfig()`, probes the database (`select 1`), lists
pending migrations (`@supastack/db` `listPendingMigrations`), counts
workspaces/admin users, and reads code constants (siteConfig brand,
DEFAULT_STYLE_ID, rootOgImage) into the pure `SetupSnapshot` contract.

## Important Notes

- SECRET SAFETY: the snapshot never carries credential values — OAuth
  client id/secret are reduced to a placeholder-looking boolean per
  provider (length < 10 or "placeholder"/"your-" markers), AUTH_SECRET to
  `{configured, length}`.
- The DB probe is wrapped: unreachable → `reachable: false` with zeroed
  counts (the page still renders instead of 500ing on a fresh clone).
- `listPendingMigrations` error → `pendingMigrations: null` (the
  "Could not read migration state" row); a missing table is all-pending
  inside the db function, not an error.
- `appUrl.configured` keys off `process.env.APP_URL` presence (the config
  default is localhost:3000); the URL itself (`siteOrigin()`) is public
  metadata, not a secret.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for the /setup readiness checklist (WP3) | Devin |
