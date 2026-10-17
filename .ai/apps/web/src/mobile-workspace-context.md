# src/mobile-workspace-context.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose（一句话人话）

`/api/mobile/*` 路由共享的"当前工作区 + 成员角色"解析器 —— 复用
`resolveActiveWorkspaceIdForSessionUser`（cookie → 偏好的顺序，调用方已
持有 session 验证过的 userId，不再二次解析会话），再查 membership 得到
角色；membership join 本身就是授权 —— 伪造或过期的 active-workspace
cookie 解析为 null 而不是别人的工作区。

## What It Does

- `resolveMobileWorkspaceContext(userId)` → `{role, userId, workspaceId, workspaceName, workspaceType}` | `null`
- `resolveMobileManagerContext(userId)` → 同上加 `canManageWorkspaceMembers` 过滤
- `MobileWorkspaceContext` 类型（org/personal 收窄）。

## Important Notes

- `next/headers` 的 `cookies()` 在 route handler 里读的就是当前请求，
  所以 Better Auth 的 cookie jar（含 `supastack.activeWorkspaceId`）
  对 Expo 客户端同样生效。
- Each request resolves the session once (the BFF's `deps.getSession`);
  this module never re-fetches it. The `workspaceMembership` join is what
  keeps a foreign/removed workspace from resolving — cookie and
  preference values are just selection hints.

## Dependencies

- `database`（auth-runtime）、`resolveActiveWorkspaceIdForSessionUser`
  （organization-actions）、`@supastack/db` 角色助手。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-11 | Session-free workspace-id resolution (`resolveActiveWorkspaceIdForSessionUser`) — one session resolution per request; membership join is the authorization | Devin |
| 2026-09-28 | Created for the `/api/mobile/*` surface | Devin |
