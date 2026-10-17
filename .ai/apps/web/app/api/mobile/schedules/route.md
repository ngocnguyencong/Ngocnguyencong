# app/api/mobile/schedules/route.ts

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

工作区 job_schedule 管理 —— 复用 `listWorkspaceSchedules` /
`upsertScheduleAction`（owner/admin）。

## What It Does

- `GET` → `{rows}`（cron/enabled/lastRunAt/nextRunAt/type）
- `POST {type, cron, enabled?}` → 创建/更新；复用 web 的校验（合法五段
  cron、类型白名单、平台保留类型拒绝、enabled 时必须可触发）。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Created | Devin |
