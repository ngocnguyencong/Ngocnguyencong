# packages/db/src/postgres.integration.test.ts

## Purpose

Optional PostgreSQL migration and repository integration coverage. The suite
runs when `TEST_DATABASE_URL` is set and exercises real transactions, workspace
ownership, billing, and AI budget reservations.

## Security Fix (2026-09-27)

The concurrent budget reservation case omits the optional AI policy row. With
the $5 platform default, only one of two $3 holds may authorize across two
database connections. The same test checks idempotency and settled spend.
Verified locally against an isolated PostgreSQL 16 container with
`TEST_DATABASE_URL` set (5 integration tests passed).
