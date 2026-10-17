# 0004_luxuriant_switch.sql

> Last updated: 2026-09-22 | Protection: CRITICAL (applied migration — never edit semantics)

## Purpose（一句话人话）

新增平台级 growth 三表：`waitlist_entry`、`early_access_code`、`referral`。

## What It Does

1. `waitlist_entry` — email 唯一、status waiting→invited→joined、
   `referral_code` 唯一、自引用 `referred_by_entry_id` (set null)、
   `referral_count` 反规范化计数、invited/joined 时间戳。
2. `early_access_code` — code 唯一、可选 email/waitlist_entry 绑定、
   created_by/redeemed_by → user（均 set null）、expires_at。
3. `referral` — append-only 归因账本；`kind` waitlist|signup；唯一索引
   `(kind, referred_user_id)` / `(kind, referred_email)` 保证幂等；
   `referred_user_id` → user cascade。

## Dependencies

- **Internal:** `src/schema.ts`、`meta/0004_snapshot.json`、`meta/_journal.json`
- **Note:** 排在未提交的 0003（feature-board/creem 在途迁移）之后 —— 提交
  时两者都保留在 journal 即可。
