# apps/web/src/notification-emit.ts

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

Pure fan-out for workspace product notifications — one
`NotificationProductEvent` → per-member in-app `notification` rows plus
best-effort email and push side-channels. Dependency-injected so vitest
runs it with fakes.

## What It Does

- `emitWorkspaceProductNotification(event, deps, options?)` — resolves
  member ids → per-user `NotificationPreferenceFlags` →
  `planWorkspaceNotifications` (in-app `inAppProduct` gate + actor
  exclusion) → `insertNotification` per planned row → returns
  `{inserted}`.
- Optional `sendPush` — fires once per **planned** row (only members who
  actually got the in-app notification) with `{title, body, userId,
  workspaceId, data: {href}}`, each inside its own try/catch so a dead
  push channel never undoes fan-out.
- Optional `sendEmail` + `getMemberEmail` — per-member transactional
  email gated by `shouldDeliverEmailNotification` (billing/invites
  categories only); per-recipient try/catch.

## Dependencies

- **Consumers:** `notification-runtime.ts` binds the Drizzle/email/push
  implementations; `tryEmitProductNotification` is what the rest of the
  app calls.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-10 | `sendPush` dep — in-app recipients also get an Expo push (wired to `sendUserPush` in notification-runtime) | Devin |
