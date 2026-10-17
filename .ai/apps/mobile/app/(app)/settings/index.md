# app/(app)/settings/index.tsx

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

Settings home: account card, workspace switcher (active badge,
`switchWorkspace` + refresh), "New organization" entry, the ten
settings-section links, feature board link, and sign-out.

## Important Notes

- Section list mirrors `web-settings-sections.ts` ids; keep labels in
  sync when web sections change.
- Sign-out runs `push.unregister()` first (while the session cookie
  still authenticates the DELETE), then `authActions.signOut()` —
  cleanup is best-effort and never blocks sign-out.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-10 | Sign-out unregisters the device push token first | Devin |
| 2026-09-28 | Created | Devin |
