# src/feature-board-actions.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose（一句话人话）

`/feedback` feature board 的 `"use server"` actions：列表读取 + 成员提交 +
投票开关 + owner/admin 状态流转与删除。

## Behavior

- `listFeatureRequests()` — `requireWorkspaceViewer()`（任何成员含 guest
  可读），按 voteCount desc → createdAt desc，返回 `myVoteIds` /
  `canWrite`（member+）/ `canManage`（admin+）。
- `createFeatureRequestAction` — writer；`normalizeFeatureRequestInput`
  校验；同事务插入 request + 作者自己的 vote（Canny 式 auto-vote，
  `voteCount=1`）；audit `feature_request.created` + emit
  `feature_request.created` webhook。
- `toggleFeatureRequestVoteAction` — writer；请求须属本 workspace；事务内
  delete-or-insert vote + `voteCount` ±1；返回最新 `{voted, voteCount}`。
- `setFeatureRequestStatusAction` — manager；`evaluateFeatureStatusChange`
  决策；audit `feature_request.status_changed` + emit
  `feature_request.status_changed` webhook。
- `deleteFeatureRequestAction` — manager  moderation；votes 级联删除；
  audit `feature_request.deleted`。
- 所有 mutation `revalidatePath("/feedback")`。

## Dependencies

- `./workspace-access` — `requireWorkspaceViewer` / `requireWorkspaceWriter` /
  `requireWorkspaceManager`。
- `@supastack/db` — `featureRequest`, `featureRequestVote`, `AUDIT_ACTIONS`。
- `./webhook-delivery` — `tryEmitWorkspaceEvent`。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-22 | Created | Devin |
