# apps/web/app/admin/organizations/page.tsx

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Platform-admin organizations list — every organization workspace with
member counts, a per-row credit-grant form, and the typed-confirmation
organization deletion form.

## What It Does

- `listAdminOrganizations()` (server action; the admin guard lives in
  `src/admin-actions.ts`) renders each org with a `<details>` "Grant
  credits…" form (hidden `workspaceId`, `amount` number input ≥1,
  optional `reason`) POSTing to `/api/admin/credits`, and a `<details>`
  "Delete…" form calling `adminDeleteOrganizationAction`.
- `searchParams.status` maps route redirects to status lines
  (`credits-granted`, `credits-invalid`, `credits-failed`, `deleted`,
  `confirm-mismatch`, `forbidden`).
- `force-dynamic` — always a fresh list.

## Important Notes

- The credit form is plain HTML POST (no client JS); the route 303s back
  with the status query.
- Server-side authorization is authoritative — the page renders controls
  only behind the admin guard, and the route re-checks the role.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-13 | Sub-nav gained Feature flags + Announcements links — every admin section now cross-links in the same order | Devin |
| 2026-10-13 | Dropped the dead `/admin/orders` nav link — no such route exists | Devin |
| 2026-10-11 | Per-organization "Grant credits" action + credit status messages | Devin |
