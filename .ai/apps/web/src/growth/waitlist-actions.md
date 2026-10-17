# src/growth/waitlist-actions.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Growth 模块的 server actions（`"use server"`）—— 公开 waitlist join +
`/admin/waitlist` 的全部管理操作。

## What It Does

- `joinWaitlistAction` — 邮箱解析 → shared client/global public-write
  admission → optional Turnstile 校验 → 读 `supastack_ref` cookie →
  `joinWaitlist` → created-only audit → redirect to localized landing;
  created joins carry rank/share code, duplicate joins return generic status.
- `inviteWaitlistEntryAction` — admin 单人邀请（email-bound 码 + 事务邮件 +
  审计）。
- `inviteWaitlistBatchAction` — admin 批量邀请（1–500，referral 优先序）。
- `removeWaitlistEntryAction` — admin 删除 entry（referral 账本保持
  append-only）。
- `createEarlyAccessCodeAction` — 独立码（可选绑邮箱/过期天数），码值经
  `?status=code-created&code=` 回显给 admin。

## Important Notes

- 邀请邮件走 `category: "transactional"` + `workspaceId: "pre-auth"`（同
  OTP/magic-link 惯例）；绝不走 outreach 通道。
- `expiresInDays` 非法/缺省 → 不过期；上限 365。
- 管理动作都过 `requireAdminSession`；禁止路径重定向
  `/admin/users?status=forbidden`。
- Client quotas use only a trusted-proxy-derived IP when configured. Every
  public write still consumes the shared fail-closed aggregate quota before
  persistence; production defaults to the Postgres-backed limiter store.
