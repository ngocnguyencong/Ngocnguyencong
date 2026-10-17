# app/api/mobile/invitations/[invitationId]/route.ts

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

`DELETE` —— 撤销 pending 邀请（owner/admin），`evaluateInviteRevocation`
判定 + 审计。missing→404、not-pending→422。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Created | Devin |
