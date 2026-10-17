# src/push/register.test.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Unit tests for `push/register.ts` decision logic — injected adapter,
api, and store; no native modules.

## What It Does

- Register: BFF register + store.save on success; undetermined →
  request → denied stops before the API call; missing projectId,
  token-fetch rejection (simulator/Expo Go), and BFF failure all map to
  `unavailable`; optional Android channel failure does not block
  registration.
- Unregister: stored-token DELETE + store.clear resolves `true`;
  explicit-token path skips `store.load`; no stored token resolves
  `true` without an API call; an API failure resolves `false` while
  still clearing local state.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | `unregister` success/failure boolean coverage | Devin |
| 2026-10-10 | Created for Expo push notifications | Devin |
