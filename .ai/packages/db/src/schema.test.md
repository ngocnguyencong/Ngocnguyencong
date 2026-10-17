# schema.test.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose（一句话人话）

`schema.ts` 的结构契约测试 —— 表集合、列类型/NOT NULL、关键唯一索引，以及 Better Auth 对 `account` 的 issuer 要求。

## What It Does

- Asserts the Core V1 table set via `getTableName`.
- Asserts column-level contracts via `getTableColumns` (`notNull`, `getSQLType()`).
- Asserts `account` carries Better Auth's `(issuer, account_id)` unique index via `getTableConfig` (regression for issue #2).

## Dependencies

- **Internal:** `./schema.ts`
- **External:** `vitest`, `drizzle-orm`

## Open Threads / Resume Context

- 2026-09-22 — Growth contracts added: `waitlist_entry` (email +
  referral_code uniques, status enum coverage, self-FK),
  `early_access_code` (code unique, optional binds), `referral` (kind
  enum + `(kind, referred_*)` uniques). All three deliberately lack
  `workspace_id`.
- 2026-10-03 — Assert the standalone FIFO `waitlist_entry.created_at` index.

## Agent Decisions / Thoughts

- **2026-09-22:** Index assertion uses `getTableConfig(account).indexes` — checks the unique index's columns resolve to `issuer`+`account_id`, not just its name.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-09-22 | (test-side) schema drifted from BA account contract | migration squash dropped issuer | added issuer/index assertions |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-22 | Growth table contracts (waitlist/early-access/referral) | Devin |
| 2026-09-22 | Added `account` issuer contract test (issue #2) | Devin |
