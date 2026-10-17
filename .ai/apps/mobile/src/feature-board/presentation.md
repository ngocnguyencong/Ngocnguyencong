# src/feature-board/presentation.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose（一句话人话）

把 board API payload 映射成 RN 屏可直接渲染的 view model（状态标签、
筛选计数、排序），纯函数可测。

## What It Does

- `toFeatureBoardPresentation(payload)` → `{requests, statusCounts, canWrite}`；
  请求按 voteCount desc → createdAt desc 排序；每项带 `voted` 标记。
- `FEATURE_STATUS_LABELS` — `open→Open` 等展示标签。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-22 | Created | Devin |
