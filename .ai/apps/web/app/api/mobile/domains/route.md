# app/api/mobile/domains/route.ts

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

自定义域名管理 —— 复用 `listWorkspaceDomains` / `addWorkspaceDomain`
（owner/admin；`CUSTOM_DOMAINS_PROVIDER=off` 时返回 enabled:false /
错误）。

## What It Does

- `GET` → `{domains, cnameTarget, enabled, manageable}`
- `POST {hostname}` → 添加（主机名规范化 + appHost/CNAME 校验在 action 内）。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Created | Devin |
