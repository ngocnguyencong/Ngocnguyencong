# app/admin/waitlist/page.tsx

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose（一句话人话）

`/admin/waitlist` —— 平台级 waitlist 管理台：waiting/invited/joined 计数、
批量邀请（referral 优先）、单人 Invite/Remove、独立 early-access 码生成。

## What It Does

- `listWaitlistEntries(500)`（内部 `requireAdminSession`）渲染列表；
  `?status=`/`?code=`/`?invited`/`?failed` 回显操作结果。
- 表单直接绑 `waitlist-actions.ts` 的 server actions。
- 导航行与其他 admin 页一致（本页已加 Waitlist 链接回其余 admin 页）。

## Important Notes

- 管理页不进 sitemap；`/admin` 已在 robots disallow。
- `Remove` 只删 waitlist_entry；referral 账本 append-only 不回滚。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-22 | 初版 | Devin |
