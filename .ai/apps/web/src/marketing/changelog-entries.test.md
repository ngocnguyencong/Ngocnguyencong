# apps/web/src/marketing/changelog-entries.test.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Guard tests for `changelog-entries.ts`: newest-first ordering, unique
ISO `YYYY-MM-DD` dates, non-empty title/points per entry, a demo-clean
copy guard, and `formatChangelogDate` output for English + non-English
`AppLocale` values.

## Important Notes

- Pure data assertions — no module graph beyond the entries file, so the
  suite stays green independently of resource-content imports.
- The demo-clean regex bans `/roadmap/i` (among promise/count/brand
  words) — entry copy must describe the "what's-planned-next board"
  without naming the route word.
- `formatChangelogDate` cases pin both the default `"en"` output and
  localized `de`/`fr` strings (`Intl.DateTimeFormat`, UTC-stable).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | `formatChangelogDate` localized-locale cases | Devin |
| 2026-10-10 | Created alongside `/changelog` page | Devin |
