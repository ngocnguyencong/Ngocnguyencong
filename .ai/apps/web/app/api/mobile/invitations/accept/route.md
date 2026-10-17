# app/api/mobile/invitations/accept/route.ts

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

`POST {token}` —— 接受邀请：`evaluateInviteAcceptance` 校验（pending/未过期/
邮箱匹配）→ 插入 membership（owner→member 钳制）→ 邀请置 accepted →
通知 + 审计 + `invite.accepted`/`member.joined` webhook → 持久化
activeWorkspaceId（`userWorkspacePreference` + 响应 cookie 双写）。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Created | Devin |
