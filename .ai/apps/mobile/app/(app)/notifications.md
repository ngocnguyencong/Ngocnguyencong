# app/(app)/notifications.tsx

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

Notification inbox: lists `/api/notifications` rows with unread weight,
tap-to-mark-read, a mark-all action, and a link into notification
preferences under Settings.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | Notification list reads through `readCachedOrFetch`; `<OfflineNotice>` on cache source | Devin |
| 2026-09-28 | Created | Devin |
