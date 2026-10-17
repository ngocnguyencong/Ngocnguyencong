# app/(app)/settings/members.tsx

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

Members section (organization workspaces only): manager invite form
(email + role), member rows with role-change/remove, pending
invitations with resend/revoke, seat counter, and leave-organization.

## Important Notes

- `canManage` gates mutation UI; the BFF still enforces owner/admin
  server-side — the UI mirrors, never substitutes.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Created | Devin |
