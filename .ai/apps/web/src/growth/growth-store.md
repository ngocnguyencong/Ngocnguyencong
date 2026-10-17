# src/growth/growth-store.ts

> Last updated: 2026-10-04 | Protection: STANDARD

## Purpose

`GrowthStore` 的 drizzle/Postgres 实现（server-only）。所有写操作
条件化/幂等：invite 首次绑定要求未核销、未过期且邮箱为空或相同；redeem
要求 `redeemed_at IS NULL`；joined/invited 单向迁移；referral 插入靠
`(kind, referred_*)` 唯一索引 + 同事务 `referralCount + 1`，重试不会双计。

## What It Does

- `findFirst`/`findMany` 走 `database.query.*`（schema 已注册三表）。
- `bindEarlyAccessCodeEmail({id,email,now})` — 单条条件 `UPDATE`：仅绑定
  尚未核销、未过期且 `email IS NULL OR email = normalizedEmail` 的码。并发
  不同邮箱只有一个能绑定；同邮箱可在用户创建失败后重试，码仍未核销。
- `createWaitlistEntry` — `onConflictDoNothing(email)` → created|duplicate。
- `countWaitlistPosition` — `count(*) where created_at <= t`（诚实 FIFO）。
- `recordReferral` — 单事务：插入（冲突则 duplicate）+ 命中后
  referrer 计数自增。

## Dependencies

- **Internal:** `./early-access`（类型）、`@supastack/db` 三表
- **Consumers:** `auth-runtime.ts`、`waitlist-actions.ts`、`waitlist-queries.ts`

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-04 | Add the atomic first-mailbox bind with expiry and redemption predicates | Codex |
