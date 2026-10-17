# app/(app)/_layout.tsx

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

Signed-in shell: guards every `(app)` route behind the session check
(`Redirect href="/"` when signed out) and mounts the four-tab navigator —
Home, Chat, Alerts, Settings — painted from the active palette.

## Important Notes

- `content` and `commerce` are declared with `href: null` — navigable
  routes (linked from the home Quick actions card) that stay out of the
  tab bar.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-13 | `href:null` tab-hides committed (the 10-12 rows were foreign-uncommitted until the content slice landed) | Devin |
| 2026-10-12 | += hidden `content`/`commerce` tab routes | Devin |
| 2026-09-28 | Tabs + auth guard | Devin |
