# tests/supabase-doctor.test.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Offline tests for `scripts/supabase-doctor.mjs` pure helpers:
`--fix-rls` parsing, pooler assessment (transaction/session/direct,
pgbouncer + env overrides, unparseable URLs), pending-migration diff,
the RLS risk report (fix SQL generation, anon/authenticated grants,
owner-mismatch warnings), and storage-endpoint reachability.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Initial tests (phase B4) | Devin |
