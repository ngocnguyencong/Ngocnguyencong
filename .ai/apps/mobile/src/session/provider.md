# src/session/provider.tsx

> Last updated: 2026-10-15 | Protection: STANDARD

## Purpose

`MobileAppProvider` — the app-wide context every screen reads through
`useMobileApp` / `useRequiredMobileApp`.

## What It Does

- Composes auth client + actions, the JSON api client, workspace state
  (`memberships`, `activeWorkspaceId`, `workspacesReady`,
  `refreshWorkspaces`, `switchWorkspace`), theme (`themeMode`,
  `palette`, `styles`, `updateThemeMode`), synced appearance
  (`syncedPacks`, `syncedThemeId`, `selectSyncedTheme`), and the `push`
  facade (`src/push/expo.ts`).
- Appearance sync: the SecureStore cold-start cache paints "Match web
  app" before the session resolves; once signed in, `fetchAppearance`
  pulls the synced pack id + server-mapped palettes and refreshes the
  cache (failures silent). `selectSyncedTheme` is optimistic (palette +
  cache + PUT) and reverts — including the cache — when the PUT fails,
  surfacing the error to the caller.
- Auto-refreshes workspaces whenever the session transitions to
  signed-in; clears workspace state on sign-out.
- Push effect: when signed-in with an `activeWorkspaceId`, registers the
  device push token (server upserts it under the active workspace — a
  workspace switch re-registers too); losing the session after having
  been signed in unregisters. `wasSignedIn` ref guards against firing
  unregister on cold start.
- Deep-link effect: `push.listenForNotificationRoutes` resolves each
  notification tap to a validated internal route; `router.push` runs
  only while signed in — a tap before sign-in buffers in
  `pendingPushRoute` and flushes when the session resolves (`signedInRef`
  keeps the listener closure current). Invalid payloads never reach the
  callback; navigation failures drop silently.
- `useRequiredMobileApp` throws when the provider hasn't materialized a
  context (e.g. `EXPO_PUBLIC_API_URL` unset) — screens under the auth
  gate use it freely.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | `offlineCache` + `offlineScope` (`${userId}:${workspaceId}`) in context; `createOfflineCache` over `createFileSystemOfflineStorage`; `clearAll` on sign-out and account switch (workspace switches keep other scopes isolated) | Devin |
| 2026-10-15 | Synced appearance state (packs/theme/palette), post-session appearance fetch + cache refresh, optimistic `selectSyncedTheme` with revert | Devin |
| 2026-10-12 | Notification-tap deep-link effect (session-gated `router.push` + pre-sign-in route buffer) | Devin |
| 2026-10-10 | `push` facade in context + session/workspace-driven register/unregister effect | Devin |
| 2026-09-28 | Created | Devin |
