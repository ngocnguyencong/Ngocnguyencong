# src/feature-board-store.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose（一句话人话）

Feature board 的共享 DB 写入层 —— server actions 和 mobile BFF 共用，
保证 request 行和 vote 计数在同一个事务里变更。

## What It Does

- `insertFeatureRequestWithAuthorVote(input)` — 一个事务内插入
  `feature_request`（status=open, voteCount=1）+ 作者的
  `feature_request_vote`（Canny 式：作者自动投票）。
- `toggleFeatureRequestVote({ requestId, userId, workspaceId })` —
  事务内：按 (requestId, workspaceId) 锁 request 行 → 查已有 vote →
  有则删 vote + `nextVoteCount(-1)`，无则插 vote + `nextVoteCount(+1)`，
  并更新 `voteCount` counter-cache。request 不存在返回 `null`。

## Important Notes

- `server-only`。所有查询都带 `workspaceId` scope。
- counter-cache (`featureRequest.voteCount`) 以 vote 行作为事实源；
  `nextVoteCount` floor 在 0，防止并发漂移出现负数。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-22 | Extracted shared transaction helpers for actions + mobile BFF | Devin |
