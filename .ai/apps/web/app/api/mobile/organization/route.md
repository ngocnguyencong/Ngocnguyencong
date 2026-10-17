# app/api/mobile/organization/route.ts

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

活动组织的成员/邀请列表 + 组织生命周期（创建/改名/删除）的 mobile 接口，
全部代理到 `mobileOrganizationBff`。

## What It Does

- `GET` → 成员 + pending 邀请 + 席位/角色信息（任何成员可读）
- `POST {name}` → 创建组织并把调用者设为 owner（201 `{workspaceId}`）
- `PATCH {name}` → 改名（owner only）
- `DELETE {confirm}` → 删除组织（owner only，confirm 必须等于当前组织名）

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Created | Devin |
