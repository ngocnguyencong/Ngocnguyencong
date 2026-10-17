# app/api/mobile/domains/[domainId]/refresh/route.ts

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

`POST` —— 重新检查域名 DNS 验证状态（owner/admin，复用
`refreshWorkspaceDomain`；验证成功时记审计 + `domain.verified` webhook）。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Created | Devin |
