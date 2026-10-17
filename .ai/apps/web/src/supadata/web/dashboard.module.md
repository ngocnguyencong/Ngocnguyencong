# apps/web/src/supadata/web/dashboard.module.css

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Shared layout styles for the analytics dashboard pages: page header row
(title + muted site domain + live pill with reduced-motion-gated pulse dot),
the responsive panel grid (`minmax(min(100%, 420px), 1fr)` — never a bare
`minmax(420px, …)` which overflows phones), empty-state step list, and the
`loading.tsx` skeleton shapes. Tokens only (`--text`, `--muted`, `--accent`,
`--raised`, radius/space tokens).

## Important Notes / NEVER Change

- Pulse animation must stay behind `@media (prefers-reduced-motion: no-preference)`.
- Keep `min(100%, 420px)` in the panel grid minmax — small viewports must
  collapse to one column without horizontal scroll.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Added for WP4 responsive dashboard layout | Devin |
