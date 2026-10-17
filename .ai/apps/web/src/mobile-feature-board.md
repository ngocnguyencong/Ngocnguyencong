# src/mobile-feature-board.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose（一句话人话）

`/api/mobile/feature-requests*` 的 drizzle/session 接线层 —— 把
`createMobileFeatureBoardBff`（纯逻辑）的依赖注入成真实 DB/audit/webhook。

## What It Does

- `mobileFeatureBoardBff` — 组装好的 BFF 实例，导出给
  `app/api/mobile/feature-requests/route.ts` 和
  `…/[requestId]/vote/route.ts`。
- 依赖注入：
  - `list`/`create`/`vote` → `feature_request` / `feature_request_vote`
    查询与 `feature-board-store.ts` 事务 helpers；
  - session → `getAuthSession(headers())`；workspace →
    `resolveActiveWorkspaceIdForUser` + membership role；
  - `canWrite` ← `canWriteWorkspace(role)`（guest 只读）；
  - audit（`feature_request.created`）+ webhook emit
    （`feature_request.created`）在 create 成功后触发。

## Important Notes

- `server-only`。与 web actions 共用 `insertFeatureRequestWithAuthorVote` /
  `toggleFeatureRequestVote`，不写第二份 SQL。
- 行映射 `toMobileRequest` 把 `Date` 转 ISO string，非法 status 回落
  `"open"`；`mine` 按 `createdBy === userId` 计算。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-22 | Created for the mobile feature board BFF | Devin |
