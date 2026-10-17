# src/auth-server.ts

> Last updated: 2026-10-04 | Protection: STANDARD

## Purpose（一句话人话）

web 侧 auth 组合边界 —— `createWebAuthServer` 把可注入工厂
（adapter/auth 实现、provisioner、earlyAccess hooks）转交给
`@supastack/auth/server` 的 `createWebAuth(WithFactories)`。

## What It Does

- `WebAuthServerInput`：database + 可选 factories/provisioner/
  `earlyAccess`（`EarlyAccessHooks`，见 `@supastack/auth` server.md）。
- 无 factories 时走生产 `createWebAuth`（drizzle adapter + betterAuth）。

## Important Notes

- This layer forwards `EarlyAccessHooks`; the shared auth/growth policy owns
  invite checks. In invite-only mode it binds a null-email code to the
  normalized mailbox after Better Auth has verified it and before user
  creation. Redemption remains in the existing post-create hook.
- `WebAuthServerInput.revokeUserApiKeys` forwards the optional API-key cleanup
  callback to `@supastack/auth/server`. Production composition supplies the
  database-backed revoker so active keys are revoked before an unverified
  mailbox is promoted; callback errors abort that promotion.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-04 | Forward the API-key revocation callback for mailbox recovery | Codex |
| 2026-10-04 | Forward the shared verified-mailbox invite admission hook to Better Auth | Codex |
| 2026-09-22 | Request-aware Better Auth `trustedOrigins` fn — active custom hostnames become per-request trusted origins | Devin |
| 2026-09-22 | `earlyAccess` 可选注入透传 | Devin |
