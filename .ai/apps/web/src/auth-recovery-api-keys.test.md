# apps/web/src/auth-recovery-api-keys.test.ts

> Last updated: 2026-10-04 | Protection: CRITICAL

## Purpose

Regression coverage for the recovery API-key callback: inspect actual SQL predicates for multiple workspace keys, require the recovering user and trusted workspace on each mutation, filter previously revoked keys, avoid writes on an empty selection, and propagate database errors. All three cases pass; this is deterministic SQL predicate verification without a live database.
