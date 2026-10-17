# app/api/mobile/members/[userId]/route.ts

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

## Open Threads / Resume Context

- 2026-10-03: authenticate before consuming a PATCH body, stream JSON through the shared 64 KiB reader, return 413 for oversize and 400 for invalid JSON. Keep the BFF's workspace and manager-role authorization authoritative.

单成员管理（owner/admin）：`PATCH {role}` 改角色（owner 只能由 owner 授予）、
`DELETE` 移除成员。决策走 `evaluateMemberRoleUpdate` / `evaluateMemberRemoval`。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Created | Devin |
