# packages/db/src/connected-accounts.integration.test.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

`TEST_DATABASE_URL`-gated Postgres coverage for the drizzle connected
account repository — real upsert/claim/envelope round-trips.

## Coverage

- Repository CRUD + upsert on `(workspace, provider, external)`; status
  transitions (`active → needs_reauth → revoked`); expiry-ordered sweep
  queries for `connected-account.token-sweep`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
