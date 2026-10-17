# src/web-feature-board-page.tsx

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose（一句话人话）

`/feedback` 的客户端页面：状态筛选 chips + 按票数排序的请求列表 + 投票按钮
+ 提交表单 + 管理者的状态流转/删除。

## What It Does

- `WorkspaceShell active="Feedback"`；guest 只读（无表单/投票），未登录看到
  sign-in 提示。
- 每个请求行：▲ 投票按钮（`aria-pressed` 反映我的投票）、title、details、
  status badge、提交时间；manager 多出 status `<select>` + Delete。
- 乐观更新投票计数（本地 setState 立即反映 toggle 结果）。
- 提交请求后立即进入可访问的 busy 状态：禁用字段和按钮、保留按钮宽度、显示
  motion-safe spinner 与 “Submitting request…” 文案，防止重复提交。

## Open Threads / Resume Context

- **Status:** in_progress
- **Intent:** Add an explicit, layout-stable pending acknowledgement to the feature request form.

## Dependencies

- `./feature-board-actions` — list/toggle/status/delete actions。
- `./feature-board` — `FEATURE_REQUEST_STATUSES` 状态筛选。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-22 | Created | Devin |

## UI foundation implementation (2026-10-06)

Shared accessible Select/Popover/Dialog behavior is integrated where applicable; shared chrome and appearance labels are localized. Workspace scope, server-authoritative actions, neutral sample content, and native form/essential reading fallbacks are preserved. Behavioral verification covers the shared primitives; live authenticated/provider flows remain outside local acceptance.
