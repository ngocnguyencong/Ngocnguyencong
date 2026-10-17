# app/(app)/settings/notifications.tsx

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Notification preferences: three switches (`emailInvites`,
`emailBilling`, `inAppProduct`) backed by
`GET/PATCH /api/notifications?view=preferences` with optimistic toggle
and revert-on-error — plus a "This device" card with the push
notifications toggle.

## What It Does

- Push toggle state resolves from `push.registeredToken()` +
  `push.permissionStatus()`: enabled (a token is stored) / disabled /
  denied (system permission off — switch locked).
- ON → `push.register()`; `permission_denied` and `unavailable` leave
  the switch off with explanatory detail copy. OFF → `push.unregister()`
  (server DELETE + local clear) — the switch only flips to disabled on
  success; a failed server DELETE keeps it enabled and surfaces an
  error, since the device is still registered remotely.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-11 | Push toggle reflects the server outcome — failed DELETE stays enabled + error | Devin |
| 2026-10-10 | "This device" push-notifications toggle | Devin |
| 2026-09-28 | Created | Devin |
