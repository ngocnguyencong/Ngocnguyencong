# apps/web/app/dashboard/loading.tsx

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Route-level loading UI for `/dashboard` — renders `Skeleton` blocks shaped
like the stat grid, trend chart, and two breakdown panels so period/tab
navigation shows structure instead of a blank while the server component
re-renders. Uses the shared `dashboard.module.css` loading classes and
`aria-busy`.

## Important Notes / NEVER Change

- Keep skeleton shapes token-only; do not add spinner or JS-only fallbacks.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Added for WP4 dashboard polish | Devin |
