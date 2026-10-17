# src/growth/waitlist.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

平台级增长模块的纯逻辑核 —— waitlist 邮箱归一化、`?ref=`/`?invite=` 码生成
与净化、early-access code 状态判定、分享/邀请 URL 构造、状态文案。无 IO。

## What It Does

- `normalizeWaitlistEmail`/`parseWaitlistJoin` — 复用 marketing-leads 的邮箱规则。
- `generateReferralCode` (10 字符) / `generateInviteCode` (12 字符) — base36
  随机码，`crypto.randomBytes`。
- `sanitizeGrowthParam` — 写 cookie/查库前净化 `?ref=`/`?invite=` 值
  （`^[a-z0-9-_]{1,64}$`，小写化）；非法值一律 null。
- `earlyAccessCodeStatus(row, {email, now})` → `valid | unknown | expired |
  redeemed | email-mismatch`；email-bound 码只认绑定地址（大小写不敏感）。
- `buildEarlyAccessUrl` → `{appUrl}/auth?invite=CODE`（proxy 会落 cookie）；
  `buildWaitlistShareUrl` → `{appUrl}/?ref=CODE`。
- `isSelfReferral` — 阻止自己给自己记推荐。
- `waitlistStatusMessage(status, {position, referralCode})` — landing 重定向
  回显文案。

## Important Notes

- 纯函数、无 server-only —— 可被 proxy/middleware 包与 server 组件共用。
- 表是平台级营销资产（无 workspaceId），与 announcement/feature_flag 同级。
