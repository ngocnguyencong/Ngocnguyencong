# tests/supabase-provision.test.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Offline tests for `scripts/supabase-provision.mjs` pure helpers: arg
parsing (required flags, unknown args, dry-run default), connection-string
building (direct/session/transaction pooler, sslmode, encoded passwords),
`.env` merge semantics (append, keep-without-force, fill-empty,
force-overwrite), and password masking.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Initial tests (phase B4) | Devin |
