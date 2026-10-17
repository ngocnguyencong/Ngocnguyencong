# src/growth/early-access.ts

> Last updated: 2026-10-04 | Protection: STANDARD

## Purpose

Early-access 生命周期编排 + `GrowthStore` 窄接口（整个 growth 模块的持久化
契约）。decision flow 可脱离 Postgres 单测；drizzle 实现在
`growth-store.ts`。

## What It Does

- `GrowthStore` 接口 — find/create/list/redeem/mark/recordReferral；实现侧
  负责原子性（条件更新、幂等插入+同事务计数）。
- `validateEarlyAccessCode(store, {code, email, now})` — auth
  `validateUserInfo` / Auth.js gate 的 DB 后端。先归一化邮箱并检查码状态；
  仅 `valid` 时调用 store 的原子绑定。绑定竞争失败后重读状态并拒绝，
  不能把并发竞争误判为放行。调用方必须先证明邮箱：Better Auth 在
  `create-user` gate 要求 `emailVerified === true`，Auth.js 先验证 provider 邮箱。
- `handleEarlyAccessUserCreated(store, {user, invite, referral, now})` —
  better-auth `user.create.after` 钩子调用：核销有效 invite 码（携带
  waitlistEntryId 则联动 joined）、按邮箱把 waitlist entry 翻成 joined、
  给 `?ref=` 码主记 `signup` referral（自推荐跳过）。返回
  `EarlyAccessCreateOutcome` 供 auth-runtime 记 audit。
- 全部副作用可降级为空操作 —— 核销/归因失败绝不能阻断建号。

## Important Notes

- The first verified normalized mailbox binds an unbound code before invite-only
  user creation. A failed user insert leaves it bound but unredeemed: that same
  mailbox can retry, while another mailbox receives `email-mismatch`. The bind
  adds no lease or schema migration.
- Successful invite redemption and waitlist/referral side effects still run
  after account creation; the pre-create bind only serializes mailbox
  eligibility.

## Dependencies

- **Internal:** `./waitlist`（纯判定）、`@supastack/i18n` 无
- **Consumers:** `auth-runtime.ts`（注入）、`waitlist-actions.ts`

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-04 | Atomically bind an invite to the first verified normalized mailbox before invite-only account creation | Codex |
| 2026-09-22 | 初版 + 返回 outcome 摘要供审计 | Devin |
