# auth-signup.integration.test.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose（一句话人话）

黄金路径 e2e：真实 Postgres + 真实 drizzleAdapter + 真实 `auth.handler` 跑
email-code sign-in，再由已验证 session 调用 server-only `setPassword`；断言
credential account 行带 `issuer` 且个人工作区完成 provisioning。

## What It Does

- 由 `TEST_DATABASE_URL` 门控（未设置则 skip，与 `packages/db` 的 integration 测试同款约定）；库须已跑过 `pnpm db:migrate`。
- `createWebAuth` 真实组合（含显式邮件 admission allow stub）→ 请求并消费
  email OTP → 用已验证 session 创建密码 → 断言 session cookie、
  `account.issuer='local:credential'` 和 owner membership。
- 收尾清理 user（级联 account/session/membership）+ workspace 行。

## Dependencies

- **Internal:** `./server.ts`（`createWebAuth`, `createDrizzlePersonalWorkspaceProvisioner`）
- **External:** `@supastack/db`（`createPostgresDatabase`）、`@supastack/config`、`vitest`

## Open Threads / Resume Context

Status (2026-10-04): implemented. The database-gated golden path now requires
email-code verification before server-only password creation and retains the
credential issuer and personal-workspace assertions.

## Agent Decisions / Thoughts

- **2026-09-22:** 查询/清理用 `lifecycle.client`（postgres.js）裸 SQL —— `drizzle-orm` 不是本包依赖，pnpm 隔离下 import 会炸（已在 drizzle-schema.test.ts 上踩过一次）。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-22 | New gated e2e for credential sign-up (issue #2) | Devin |
