# src/content-access.test.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Pure unit tests for `content-access.ts` — no DB, fixed `now`.

## Coverage

- `isContentLocked`: free entries (`requiredEntitlement: null`) never lock
  even when the viewer holds entitlements; gated entries lock on missing /
  wrong-key / `past_due` / expired grants; they unlock on `active` or
  `trialing` rows whose `expiresAt` is null or in the future.
- `applyContentAccess`: locked rows return `locked: true`, `body: ""`, and
  keep teaser metadata (`excerpt`, `title`, `requiredEntitlement`); entitled
  or ungated rows pass through with `locked: false` and intact `body`.

## Change History

| Date | Change | Author |
| ---- | ------ | ------ |
| 2026-09-27 | Created for tier-gated CMS entries | Devin |
