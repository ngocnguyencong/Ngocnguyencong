# src/mobile-feature-board-bff.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose（一句话人话）

`/api/mobile/feature-requests*` 的框架无关边界 —— 认证/工作区/读写逻辑
依赖注入，离开 Next/Better Auth/Drizzle 也能确定性测试（同
`mobile-entitlement-bff` 模式）。

## What It Does

- `createMobileFeatureBoardBff(deps)` → `{ list, create, vote }`：
  - `list(headers)` → 401 | 200 `{requests, votedRequestIds, canWrite, workspaceId}`
  - `create(headers, body)` → writer-only；校验失败 422；201 `{request}`
  - `vote(headers, requestId)` → writer-only；200 `{voted, voteCount}`
- 所有错误统一 `{error:{code,message}}` 信封。

## Dependencies

- 路由层在 `app/api/mobile/feature-requests/` 注入 drizzle + session 实现。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-22 | Created | Devin |
