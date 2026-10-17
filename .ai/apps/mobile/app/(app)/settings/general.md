# app/(app)/settings/general.tsx

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

General section: account Profile card (display name via
`createMobileProfileActions(auth)` → `auth.updateUser`, matching the web
general-settings form), active-workspace summary, manager-only org
rename, and the owner-only danger zone — delete requires typing the
organization name (matches the BFF `confirm` contract), then switches
to another membership before returning to settings. The name field
resyncs to `session.data.user.name` only when that value changes so
background session refreshes never clobber an in-flight edit.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-13 | += Profile card (display name edit via `auth.updateUser`) | Devin |
| 2026-09-28 | Created | Devin |
