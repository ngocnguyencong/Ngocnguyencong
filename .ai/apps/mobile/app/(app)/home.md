# app/(app)/home.tsx

> Last updated: 2026-10-12 | Protection: STANDARD

## Purpose

Workspace dashboard: name/role header, monthly stat grid (AI spend,
tasks, threads, members, invites, unread), plan card with entitlement
fallback, and quick links into chat, content, commerce, notifications,
feature board, and settings. Data: `metrics` + `entitlements` clients,
reloads on workspace switch.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | Home data reads route through `readCachedOrFetch` (offlineScope-scoped key); `<OfflineNotice>` renders when the read came from cache | Devin |
| 2026-10-12 | Quick actions += `/content` + `/commerce` links | Devin |
| 2026-09-28 | Created | Devin |
