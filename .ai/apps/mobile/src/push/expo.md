# src/push/expo.ts

> Last updated: 2026-10-12 | Protection: STANDARD

## Purpose

Native glue for push registration — the `expo-notifications` /
`expo-constants` / `expo-secure-store` adapter behind the pure
`register.ts` flow. Not unit-tested (same rule as
`purchases/revenuecat-sdk.ts`).

## What It Does

- `createMobilePushNotifications(api)` — the facade `session/provider`
  exposes as `push`: `register()`, `unregister()` (`false` when the
  server-side delete failed), `registeredToken()`, `permissionStatus()`,
  `listenForNotificationRoutes(onRoute)`.
- `listenForNotificationRoutes` — notification-tap fan-out: subscribes
  `addNotificationResponseReceivedListener` for live taps and drains
  `getLastNotificationResponse()` (then `clearLastNotificationResponse`)
  for the cold-start tap, deduping on `request.identifier` because Expo
  can surface the launch response through both channels. Each response
  resolves through `routeForNotificationResponse` (`deep-links.ts`) —
  the callback only sees validated internal paths; session gating and
  `router.push` live in `session/provider`. Every step is try/catch —
  subscribe, drain, resolve, and unsubscribe never throw.
- Adapter: `getPermissionsAsync`/`requestPermissionsAsync` →
  granted|denied|undetermined; projectId ←
  `Constants.expoConfig.extra.eas.projectId` then `easConfig.projectId`
  (null → `unavailable`); `getExpoPushTokenAsync({projectId})`;
  `setNotificationChannelAsync("default", HIGH)` on Android only —
  matches the `channelId: "default"` the server sets for android rows.
- `PushTokenStore` on `expo-secure-store` key `supastack.push.token`.
- Module scope installs `setNotificationHandler` (banner+list
  foreground presentation, no sound/badge) inside try/catch.
- `Platform.OS` ios/android pass through; anything else maps to `"web"`.

## Important Notes

- `expo-notifications@~57` + `expo-constants@~57` are the SDK 57
  `expo install`-matched versions; `app.json` `plugins` includes
  `"expo-notifications"` for the Android channel/FCM + iOS
  `aps-environment` prebuild wiring.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-12 | `listenForNotificationRoutes` — tap→route listener (live + launch response, identifier-deduped) | Devin |
| 2026-10-11 | `unregister()` forwards the server outcome (`boolean`) | Devin |
| 2026-10-10 | Created for Expo push notifications | Devin |
