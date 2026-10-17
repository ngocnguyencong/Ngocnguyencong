# apps/web/app/admin/users/page.tsx

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

Platform-admin users list — search by email/name plus per-row role
toggle, ban/unban, session revocation, impersonation, and a
typed-confirmation deletion form.

## What It Does

- `listAdminUsers(q)` + `filterAdminUsersBySearch` render the roster;
  `?q=` drives the search form, `?status=` echoes action results.
- Row forms bind `src/admin-actions.ts` server actions; the admin guard
  is server-side. The signed-in admin's own row renders a `you` badge
  instead of action forms.
- `force-dynamic` — always a fresh list.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-13 | Sub-nav gained Feature flags + Announcements links — every admin section now cross-links in the same order | Devin |
| 2026-10-13 | Dropped the dead `/admin/orders` nav link — no such route exists | Devin |
