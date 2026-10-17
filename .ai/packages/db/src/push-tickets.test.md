# packages/db/src/push-tickets.test.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Unit tests for `createDrizzlePushTicketRepository` — no database
required; same capturing-database + `PgDialect` SQL assertion approach
as `push-tokens.test.ts`.

## What It Does

- Asserts the `push_ticket` table name, `idx_push_ticket_created_at`
  index, and nullable `user_id` via `getTableConfig`.
- Covers: record input validation (blank id/token, non-string userId),
  query validation (bad date, non-positive limit, blank ids),
  insert-or-ignore recording with the exact inserted rows, empty-batch
  short-circuits, `listDue` oldest-first + limit + `created_at`
  predicate params, `remove` in-array delete + returning count, and the
  `removeOlderThan` sweep.
- Rendered `where` params compare ISO strings — the dialect serializes
  `Date` arguments.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for Expo push receipt reconciliation (WP6) | Devin |
