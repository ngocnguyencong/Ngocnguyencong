# apps/mobile/app.json

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

Expo app config: name/slug/version, portrait + automatic UI style,
`com.supastack.app` iOS/Android identifiers, typed-routes experiment, and
the config-plugin list.

## What It Does

- `plugins`: `expo-router`, `expo-secure-store`, `expo-notifications` —
  the notifications plugin carries the Android channel/FCM defaults and
  the iOS `aps-environment` entitlement into prebuild/EAS builds.
- No `extra.eas.projectId` ships: `src/push/expo.ts` reads it at runtime
  and treats its absence as `unavailable` (registration silently skips
  until the app links an EAS project).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-10 | `expo-notifications` plugin entry for Expo push | Devin |
