# apps/mobile/package.json

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

Expo workspace scripts and direct runtime dependencies for the mobile app.
It pins `react-native-purchases@10.11.0` for native iOS and Android store
transactions, and `expo-notifications` + `expo-constants` (SDK-matched
`~57` versions) for Expo push registration.

## Important Notes / NEVER Change

- Real store transactions require an EAS development or production native build; Expo Go cannot load or validate the native store module.
- Keep API keys limited to RevenueCat public, app-specific SDK keys.
- `@supastack/design-tokens: workspace:*` supplies the shared native palette, status roles, and motion durations. Keep the pinned root lockfile in sync.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | `expo-file-system@~57.0.7` (SDK-57-compatible, published 2026-09-11) for the offline read cache JSON files | Devin |
| 2026-10-10 | `expo-notifications@~57.0.22` + `expo-constants@~57.0.17` for Expo push | Devin |
| 2026-10-03 | `license` field added (`SEE LICENSE IN LICENSE.md`) | Devin |
| 2026-10-01 | Pin RevenueCat React Native SDK for Expo IAP | Codex |
