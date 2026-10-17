# src/feature-board/client.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose（一句话人话）

Cookie-auth 的移动端 feature board API client —— 打
`/api/mobile/feature-requests`（GET 列表 / POST 提交）与
`/[requestId]/vote`（POST 投票开关）。

## What It Does

- `createMobileFeatureBoardActions({apiUrl, getCookie}, request?)` →
  `fetchBoard()` / `createRequest({title,details})` / `toggleVote(requestId)`。
- 响应经 `isRecord` 守卫严格解析；非 ok → 带 `error.message` 的 Error。
- 无 cookie → 直接抛 "session unavailable"（不发请求）。

## Dependencies

- 同 `src/entitlements/client.ts` 的 fetch 注入模式（可测）。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-22 | Created | Devin |
