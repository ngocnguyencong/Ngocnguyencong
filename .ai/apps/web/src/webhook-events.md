# src/webhook-events.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose（一句话人话）

Workspace 出站 webhook 可订阅事件类型清单（`WEBHOOK_EVENTS`）+ type guard。

## Important Notes / NEVER Change

- `ping` 是连通性验证事件，`developers-settings.tsx` 的订阅 UI 会过滤它。
- 新事件类型加入数组即可被订阅 UI 自动列出；emit 侧用
  `tryEmitWorkspaceEvent({eventType, workspaceId, data})`。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-22 | +`domain.verified` (custom domains, pending → active) | Devin |
| 2026-09-22 | +`feature_request.created` / `feature_request.status_changed` | Devin |
