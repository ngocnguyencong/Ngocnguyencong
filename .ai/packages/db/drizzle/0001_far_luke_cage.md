# 0001_far_luke_cage.sql

> Last updated: 2026-09-22 | Protection: CRITICAL (applied migration — never edit semantics, only comment-level fixes)

## Purpose（一句话人话）

给 `account` 补 Better Auth 1.7.x 必需的 `issuer` 列并把账户唯一键换成 `(issuer, account_id)` —— issue #2 的修复迁移。

## What It Does

1. `ADD COLUMN IF NOT EXISTS issuer text`（可空）
2. `UPDATE … WHERE issuer IS NULL` 回填：`credential` → `local:credential`；其余 → `local:oauth:<provider_id>`（即 BA 的 `createLocalAccountIssuer`/`createOAuthAccountIssuer` 约定；已带真实 issuer 的行保持不变）
3. `ALTER COLUMN issuer SET NOT NULL`
4. `DROP INDEX IF EXISTS idx_account_provider_account` + `CREATE UNIQUE INDEX IF NOT EXISTS idx_account_issuer_account (issuer, account_id)`

## Dependencies

- **Internal:** `src/schema.ts`（`account` 表）、`meta/0001_snapshot.json`、`meta/_journal.json`
- **External:** drizzle-kit migrate 执行；上游契约在 `@better-auth/core/dist/db/get-tables.mjs`

## Open Threads / Resume Context

Idle — 已在 docker postgres 上验证三种库态：全新建库 / 已有 issuer 列+NULL 行 / 已有 issuer 值。

## Agent Decisions / Thoughts

- **2026-09-22:** 全语句幂等是有意的 —— 基线压缩（6c5d85a）前由 push/auth-generate 建出的库可能已带 `issuer` 列，裸 `ADD COLUMN` 会 42701，裸 `NOT NULL` 会在存量行上炸。
- **2026-09-22:** 不在迁移里删孤儿 user —— magic-link 登录本来就不写 account 行，"无 account" 不是安全的孤儿判据。清理留给人工（dev 库可 `DELETE FROM "user" WHERE NOT EXISTS (SELECT 1 FROM account a WHERE a.user_id = "user".id)`）。

## Important Notes / NEVER Change

- 已应用迁移不可改写语义；要再动 account 结构就开新迁移。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-22 | drizzle-kit generate 后手工改写为幂等+回填版本 | Devin |
