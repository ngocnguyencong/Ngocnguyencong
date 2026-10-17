# app/api/mobile/invitations/route.ts

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

`POST {email, role?}` —— 创建并邮件发出 workspace 邀请（owner/admin）。
与 web `createWorkspaceInviteAction` 相同的去重（已成员/已邀请）、席位
上限、7 天 token、审计记录。role 默认 member，仅 admin|member|guest 合法。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Created | Devin |
