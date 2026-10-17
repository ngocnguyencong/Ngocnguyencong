# src/workspace-access.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose（一句话人话）

Session + active-workspace + role 解析的统一入口，供 server actions 鉴权。

## What It Does

- `requireWorkspaceManager()` — owner/admin（`canManageWorkspaceMembers`）；
  用于开发者面（API keys/webhooks）与 feature board 状态流转/删除。
- `requireWorkspaceWriter()` — member 及以上（guest 只读）；内容/商城/board
  提交与投票用。返回 `{role, userId, workspaceId}`。
- `requireWorkspaceViewer()` — 任何成员（含 guest）；board 列表读取用。
  返回 `{role, userId, workspaceId}`。
- `canExportWorkspaceData()` — `requireWorkspaceManager` 的 fail-closed
  boolean 版：request scope 外（`headers()` 抛错）或任何查询失败都返回
  false，仅供 Settings → General 导出卡显隐；真正的鉴权在 export 路由。

## Important Notes / NEVER Change

- 全部经 `resolveActiveWorkspaceIdForUser` 取 active workspace——不要绕过它
  直接取第一条 membership。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | +`canExportWorkspaceData` fail-closed boolean for the settings export card (WP8) — swallows out-of-request-scope `headers()` errors | Devin |
| 2026-09-22 | +`requireWorkspaceViewer` for the guest-readable feature board | Devin |
