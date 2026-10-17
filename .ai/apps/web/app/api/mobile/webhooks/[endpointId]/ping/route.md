# app/api/mobile/webhooks/[endpointId]/ping/route.ts

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

`POST` —— 向该端点发送 `ping` 测试事件，走完整投递路径验证连通性
（owner/admin，复用 `pingWebhookEndpointAction`）。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Created | Devin |
