# src/api/client.test.ts

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

Vitest coverage for `createMobileApiClient`: cookie/JSON header plumbing,
body serialization, `MobileApiError` mapping for both error payload
shapes, the 401 no-cookie fast path, and the `parse` hook.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Created | Devin |
