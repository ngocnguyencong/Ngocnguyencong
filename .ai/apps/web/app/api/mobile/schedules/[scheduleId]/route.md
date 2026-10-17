# app/api/mobile/schedules/[scheduleId]/route.ts

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

`DELETE` —— 删除工作区调度（owner/admin）。FormData 桥接
`removeScheduleAction`（已不存在的调度视为幂等成功 + 审计）。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Created | Devin |
