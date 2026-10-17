# app/api/mobile/usage/route.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Mobile BFF twin of Settings → Usage — `GET` returns the current-month
workspace usage overview (`getWorkspaceUsageOverview`: AI spend vs budget,
per-meter plan limits/caps, prepaid credits) resolved through the mobile
workspace context.

## Important Notes

- Auth: `getAuthSession` → 401 `Unauthorized`; `resolveMobileWorkspaceContext`
  → 403 `No workspace`. Any workspace member may read — caps are managed
  on web only, so the payload stays read-only here.
- Follows the `api/mobile/credits` convention: no Origin/CSRF check (the
  mobile client authenticates via session cookie, not browser origin).
- Microunits are decimal strings in the payload — the mobile client
  validates them strictly (`apps/mobile/src/usage/client.ts`).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for workspace usage controls (WP2) | Devin |
