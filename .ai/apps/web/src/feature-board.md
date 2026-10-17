# src/feature-board.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose（一句话人话）

Feature board 的纯逻辑层：状态枚举、输入归一化、状态流转决策、票数增减 —
— 不碰 DB/Next，全部可单测。

## What It Does

- `FEATURE_REQUEST_STATUSES` —
  `open → under_review → planned → in_progress → shipped | closed`。
  `closed` 是 "won't do / 关闭"；生命周期自由流转（管理者随时改）。
- `isFeatureRequestStatus` — type guard。
- `normalizeFeatureRequestInput` — title trim 1–200 必填；details trim
  0–5000 可选（存空字符串，不留 null）。
- `evaluateFeatureStatusChange(current, next)` —
  ok | invalid（非法状态）| unchanged（同状态）。
- `nextVoteCount(current, hasVoted)` — 投票开关的计数增减（≥0）。

## Dependencies

- 无（纯函数）。Actions 层在 `feature-board-actions.ts`。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-22 | Created for the workspace feature board | Devin |
