# apps/web/app/organization/settings/page.tsx

> Last updated: 2026-10-03 | Protection: STANDARD

## Purpose

Organization settings surface for owners/admins, including the shared logo
upload action and status messages for success, invalid input, authorization,
and upload admission limits.

## Important notes

- Keep the upload form bound to `uploadOrganizationLogoAction` and scoped to
  the server-validated active workspace.
- Show the rate-limited status when upload admission rejects the action.
