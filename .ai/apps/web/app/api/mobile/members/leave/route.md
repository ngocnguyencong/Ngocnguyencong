# app/api/mobile/members/leave/route.ts

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

`POST` —— 当前用户离开活动组织。BFF 内做 `evaluateLeaveOrganization`
（personal 不可退、最后 owner 不可退），成功后 preference 回退到剩余
membership。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Created | Devin |
