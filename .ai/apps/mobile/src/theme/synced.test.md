# src/theme/synced.test.ts

> Last updated: 2026-10-15 | Protection: STANDARD

## Purpose

Tests for the synced-appearance client — `expo-secure-store` mocked with
an in-memory map, `MobileApiClient` over a route-stub transport:
`fetchAppearance` parses the snapshot and drops malformed packs (bad hex,
incomplete status groups, non-pack entries), `updateSyncedTheme` PUTs
`{theme}`, and the SecureStore cache round-trips a validated palette
while rejecting missing/malformed entries.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-15 | Created (6 tests) | Devin |
