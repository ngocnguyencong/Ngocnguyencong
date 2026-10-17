# app/api/notifications/route.ts

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose（一句话人话）

通知中心 REST 接口 —— web 通知页与 mobile 通知中心共用：拉取 in-app
通知、读/写通知偏好、标记已读。

## What It Does

- `GET` → `{notifications}`；`GET ?view=preferences` → `{preferences}`
- `PATCH {id}` → 标记单条已读（`markNotificationReadForRequest`）
- `PATCH {preferences:{emailInvites?,emailBilling?,inAppProduct?}}` →
  更新偏好（`updateNotificationPreferencesForRequest`），只透传白名单布尔字段。

## Important Notes

- 偏好更新按 (userId, workspaceId) 行 upsert 在 notification-service 内部；
  路由只做形状校验。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | PATCH 新增 preferences 分支（mobile 通知设置页需要） | Devin |
