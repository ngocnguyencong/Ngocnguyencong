# app/api/mobile/invitations/[invitationId]/resend/route.ts

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

`POST` —— 重发邀请邮件（owner/admin）。`evaluateInviteResend`：过期则
轮换 token + 重置 7 天过期，再发邀请邮件 + 审计。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Created | Devin |
