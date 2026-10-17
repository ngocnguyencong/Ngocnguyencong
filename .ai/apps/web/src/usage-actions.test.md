# src/usage-actions.test.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Unit tests for the Settings → Usage server actions: the owner/admin role
gate (`forbidden` for members/guests, `/auth` when signed out), strict
budget parsing edge cases (`1.234`, `-1`, `abc`, empty, ceiling,
`reset=1`), cap parsing (catalog-key validation, `0`, `MAX_USAGE_QUOTA`,
clear semantics), audit recording, and the redirect statuses. Auth,
membership, audit, and `redirect` are vi-mocked like the other settings
action tests.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for workspace usage controls (WP2) | Devin |
