# drizzle-schema.test.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose（一句话人话）

验证 `@supastack/db` 的 Drizzle schema 满足 Better Auth 适配器的字段契约 —— 复现 issue #2 的精确失败路径（无需数据库连接）。

## What It Does

- Builds the REAL `drizzleAdapter(stubDb, { provider: "pg", schema })` with the REAL auth options from `createBetterAuthOptions` (all plugins enabled).
- `adapter.create({ model: "account", data })` — the adapter's `checkMissingFields` throws `The field "issuer" does not exist…` on a drifted schema BEFORE touching the db stub, so this catches schema↔BA drift exactly as production saw it.
- Sweeps `getAuthTables(options)` (`@better-auth/core/db`) and asserts every declared field exists on the matching drizzle table object, plus the `(issuer, account_id)` unique index exists — catches future BA upgrades adding required fields.

## Dependencies

- **Internal:** `./index.ts` (createBetterAuthOptions), `@supastack/db/schema`
- **External:** `@better-auth/drizzle-adapter`, `@better-auth/core` (devDep, pinned to BA version), `vitest`, `@supastack/config`

## Open Threads / Resume Context

- **Status:** implemented (2026-10-04)
- **Result:** The fixture supplies an explicit mail-admission allow stub; the
  schema test still exercises the real adapter field contract.

## Agent Decisions / Thoughts

- **2026-09-22:** Chose adapter-level testing over schema-object unit checks because the production failure lives inside `checkMissingFields`; a stub `db` (`insert→values→returning`) is enough since the check runs pre-query.
- **2026-09-22:** The sweep uses `fieldAttributes.fieldName` (the schema-object key), matching how the adapter resolves columns — this is TS prop name, not the snake_case column name.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-09-22 | account.issuer missing → 500 on sign-up | BA contract drift undetected | this test is the drift detector |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-22 | New test file (issue #2 regression) | Devin |
