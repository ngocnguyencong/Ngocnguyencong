# app/(app)/chat/index.tsx

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

Thread list screen: loads `listThreads`, creates threads via
`createThread` → pushes `/chat/[id]`, and lists rows ordered by the
server's `updatedAt`. Each row's title area stays pressable to open the
thread; below it sit Rename (inline `AppInput` + Save/Cancel, mirroring
the settings rename-field convention) and Delete (`Alert.alert`
confirmation, then `deleteThread`). Successful mutations update list
state through the pure `renameThreadInList` / `removeThreadFromList`
reducers — no refetch.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | Thread list reads through `readCachedOrFetch`; `<OfflineNotice>` on cache source | Devin |
| 2026-10-13 | += per-row rename (inline field) + delete (Alert confirm) | Devin |
| 2026-09-28 | Created | Devin |
