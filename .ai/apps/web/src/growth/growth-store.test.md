# apps/web/src/growth/growth-store.test.ts

> Last updated: 2026-10-04 | Protection: CRITICAL

## Purpose

Pin the Drizzle SQL predicate and losing-update result for first-use invite
email binding without requiring a live Postgres database.

## Coverage

- A mocked update builder is compiled through `PgDialect`; the generated
  predicate includes an unredeemed row, no expiry or an expiry later than
  `now`, and either a null code email or the same normalized email. The update
  sets the email and `updatedAt` and returns success when a row is returned.
- An empty `RETURNING` result represents a competing or stale claim and maps to
  `false`, allowing `validateEarlyAccessCode` to re-read status and fail closed.
- This is a SQL-shape/unit test, not a live Postgres concurrency test.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-04 | Pin the conditional update for atomic invite mailbox binding | Codex |
