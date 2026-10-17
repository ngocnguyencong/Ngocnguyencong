# apps/web/src/marketing/roadmap.module.css

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

CSS module for `roadmap-page.tsx`: status-grouped item cards (`.items`,
`.item`, `.itemHead`, `.status`) and the closing `.cta` line, all on theme
tokens inside the utility-page `.prose` column.

## Important Notes

- `.status[data-status]` maps roadmap status → semantic token
  (`--success` shipped, `--info` in_progress, muted otherwise); the
  `[data-status]` attribute is set from `item.status` in the component.
- Flex layout with internal text wrapping — 320px-safe, no fixed grids.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-10 | Created for the public `/roadmap` route | Devin |
