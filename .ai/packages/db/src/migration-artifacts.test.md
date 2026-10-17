# migration-artifacts.test.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose（一句话人话）

守护 `packages/db/drizzle/` 迁移产物 —— journal/快照/SQL 三件套一致，关键表/索引/列确实出现在已生成 SQL 里。

## What It Does

- Reads `meta/_journal.json`; asserts sequential idx + matching `.sql` and `_snapshot.json` exist.
- Joins ALL migration SQL and asserts required `CREATE TABLE` / `CREATE UNIQUE INDEX` / column fragments exist.
- Pins migration 0014's standalone `waitlist_entry.created_at` index for the public FIFO rank query.
- Asserts the `account.issuer` migration is idempotent: `ADD COLUMN IF NOT EXISTS`, backfill for NULL rows (`local:credential` / `local:oauth:`), `SET NOT NULL`, `DROP INDEX IF EXISTS` + `CREATE UNIQUE INDEX IF NOT EXISTS` (issue #2).

## Dependencies

- **Internal:** `../drizzle/**` artifacts
- **External:** `vitest`, `node:fs`

## Open Threads / Resume Context

Idle.

## Agent Decisions / Thoughts

- **2026-09-22:** Idempotency assertions exist because the 0000 squash left real DBs in three states (no column / column+NULLs / column+values) — a bare `ADD COLUMN … NOT NULL` would fail on all of them (42701 or NULL violation).

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-09-22 | migration would fail on drifted DBs | squash dropped issuer from baseline while live DBs kept it | pin `IF NOT EXISTS` + backfill contract in test |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-22 | Assert growth tables + referral unique indexes in joined SQL (0004) | Devin |
| 2026-09-22 | Added account-issuer migration assertions (issue #2) | Devin |
