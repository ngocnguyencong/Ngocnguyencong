# apps/web/app/api/admin/credits/route.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

`POST /api/admin/credits` — platform-admin credit grant into a target
workspace's prepaid pool.

## What It Does

- Same-origin guard first (`Origin` header must equal the configured web
  origin) → `403`/`forbidden` redirect otherwise — parity with the billing
  BFF's `hasTrustedOrigin`.
- Auth: `auth.api.getSession` + `isAdminRole`; non-admins get `403` (JSON)
  or a 303 redirect back to `/admin/organizations?status=forbidden`
  (HTML form posts).
- Accepts urlencoded/multipart form bodies (the admin organizations page)
  AND JSON; validates `workspaceId` + whole-number `amount` 1..
  `MAX_CREDIT_AMOUNT` + optional `reason` ≤255 chars (`422` on JSON
  callers). String amounts must be pure digits — `parseInt` truncation
  ("10abc" → 10) is rejected.
- Verifies the target `workspace` row exists (`404`), then
  `grantWorkspaceCredits` with `actorUserId` = the admin user, then
  `recordAuditEvent` (`admin.credits_granted`, `targetType: "workspace"`).
- The audit write is isolated: a failed `recordAuditEvent` is captured via
  `serverObservability` but the response still reports the committed grant
  — reporting failure would invite a double-granting retry.
- Form callers land on `/admin/organizations?status=credits-granted` (or
  `credits-invalid` / `credits-failed`); JSON callers get
  `{ ok: true, balance }`.

## Important Notes

- The admin UI is a plain progressive-enhancement `<form method="post">`;
  the 303 See Other keeps POST→GET semantics.
- Admin grants carry no `referenceId`, so they are intentionally not
  deduplicated — an explicit double-submit posts twice.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-12 | +same-origin guard, strict digit-only amount parsing, audit write isolated from the committed grant | Devin |
| 2026-10-11 | Admin credit grant endpoint with audit write | Devin |
