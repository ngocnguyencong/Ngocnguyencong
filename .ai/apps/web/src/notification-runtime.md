# apps/web/src/notification-runtime.ts

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

Drizzle/email/push wiring for `emitWorkspaceProductNotification` — the
runtime seam every product event goes through
(`tryEmitProductNotification`).

## What It Does

- `emitProductNotificationForWorkspace(event, options?)` — binds deps:
  member ids ← `workspaceMembership`, preferences ←
  `notificationPreference`, insert ← `notification` table, emails ←
  server transactional sender, ids `ntf_${randomUUID()}`.
- `sendPush` dep → `sendUserPush` from `./push` (Expo push to every
  device token the user registered).
- `tryEmitProductNotification` — swallows every failure: notification
  fan-out must never undo billing, invite, or AI outcomes.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-10 | Wired `sendPush` → `sendUserPush` for Expo push delivery | Devin |
