# src/growth/waitlist-service.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Waitlist join + admin invite 编排（store seam 上可单测）。

## What It Does

- `joinWaitlist(store, {email, referral, now, createId, referralCode})` —
  归一化邮箱 → 解析 `?ref=` 归属（自推荐跳过）→ 唯一插入（duplicate 只回
  通用 outcome，不再读取已有 position/referral code）→ 记 `waitlist`
  referral → 新 entry FIFO 排位。
- `buildEarlyAccessInviteEmail({signupUrl, locale})` — i18n 事务邮件
  （`mail.earlyAccessSubject/Body`）。
- `issueEarlyAccessInvite(store, entry, …)` — 单个邀请原子步骤：mint
  email-bound 码 → entry 翻 `invited` → 发信；失败保留码+状态返回
  `failed`（admin 可重发）。
- `inviteWaitlistEntries(store, {count, …})` — 批量邀请，排序
  `referralCount desc, createdAt asc`（帮产品增长的人先拿号）。

## Important Notes

- 排位是诚实 FIFO；referralCount 影响的是 admin 邀请顺序，不是展示排位。
- `WaitlistMailer` 是最小 sender seam —— 由事务 EmailSender 适配
  （`workspaceId: "pre-auth"`，与 OTP 同惯例）。

Duplicate submissions reveal no queue rank, referral code, or other stored
entry details.
