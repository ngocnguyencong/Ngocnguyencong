# packages/db/src/push-tokens.test.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Unit tests for `createDrizzlePushTokenRepository` — no database required.

## What It Does

- Asserts the `device_push_token` table name + unique/index names via
  `getTableConfig`.
- A capturing-database stub records the drizzle insert/select/delete
  chains; `where` clauses are rendered through `PgDialect.sqlToQuery` so
  scoping is asserted on generated SQL + params, not opaque drizzle
  internals.
- Covers: input validation (blank ids, >255/blank token, bad platform),
  upsert conflict target = `token` column with the full re-point set,
  injected `createId`/`now`, caller-scoped `unregister` true/false,
  user/workspace/user-list scoping, trimmed-token persistence, the
  per-user cap prune (`offset(MAX-1)` + delete on overflow, skipped when
  under the cap), `PUSH_TOKEN_LIST_LIMIT` bounds, and `removeTokens`
  pruning with empty-input short-circuits.
- The select-chain stub returns a thenable query object recording
  `orderBy`/`limit`/`offset` calls so list bounds and the cap-prune
  overflow query are assertable without a database.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Cap-prune + list-limit + trim coverage; query stub gained limit/offset chaining | Devin |
| 2026-10-10 | Created for Expo push notifications | Devin |
