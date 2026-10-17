# src/push/register.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Push-registration decision logic, fully dependency-injected so vitest
exercises it without `expo-notifications` — the same pure-core/native-
glue split as `purchases/paywall.ts` vs `revenuecat-sdk.ts`.

## What It Does

- `registerForPushNotifications({adapter, api, store?})` — permission
  (`get` → `request` when undetermined) → projectId → native Expo token
  → optional Android channel → BFF `api.register` → `store.save`.
  Terminal states: `registered` (+token), `permission_denied`,
  `unavailable`. **Never throws** — simulators, Expo Go, missing
  projectId, offline, and BFF failures all resolve so sign-in and
  navigation are never blocked.
- `unregisterPushNotifications({api, store?, token?})` → `boolean` —
  DELETEs the token (explicit or stored), then always clears the local
  store so the next sign-in re-registers. Resolves `false` when the
  server DELETE failed — the device is still registered remotely, so
  callers (the settings toggle) can keep an honest enabled state.
- `PushTokenStore` — `load/save/clear` contract the SecureStore impl in
  `expo.ts` satisfies; persists the last registered token across
  restarts so sign-out can unregister it.

## Important Notes

- Push opt-out is the device-token delete itself (settings toggle or
  sign-out); the web `inAppProduct` preference gates whether the server
  even attempts delivery.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | `unregisterPushNotifications` returns success (`false` on server-DELETE failure) | Devin |
| 2026-10-10 | Created for Expo push notifications | Devin |
