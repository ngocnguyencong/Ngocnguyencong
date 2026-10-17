# src/appearance-sync.test.ts

> Last updated: 2026-10-15 | Protection: STANDARD

## Purpose

Unit tests for `createAppearanceSync` with an injected repository stub
(`server-only`, `auth-runtime`, and `@supastack/db` mocked): empty row →
null snapshot; valid row → parsed prefs + `updatedAt`; stale catalog ids →
`preferences: null` with `updatedAt` preserved; `save` upserts and returns
the persisted stamp.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-15 | Created (4 tests) | Devin |
