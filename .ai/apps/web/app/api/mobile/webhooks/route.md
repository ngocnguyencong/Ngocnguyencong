# app/api/mobile/webhooks/route.ts

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

出站 webhook 端点管理 —— 复用 `listWebhookEndpoints` /
`createWebhookEndpointAction`（owner/admin）。

## What It Does

- `GET` → `{endpoints, manageable}`
- `POST {url, events[]}` → 201 `{endpointId, secret}` — 签名密钥仅此一次
  返回；URL 校验（生产环境必须公网 https、无凭据）。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Created | Devin |
