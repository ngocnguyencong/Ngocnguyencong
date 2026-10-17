# apps/web/src/marketing/changelog-page.tsx

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Server component rendering `/changelog` content inside the marketing shell:
utility-page hero + `ChangelogTimeline` kit block fed by `changelogEntries`
(typed `date/title/points` data adapted to the block's `meta/title/points`
props). Takes a `locale: AppLocale` prop (default `"en"`); chrome copy comes
from `RESOURCE_COPY[locale].changelog`.

## Important Notes

- Localized chrome only: h1, intro, the first-entry `latestBadge`, and the
  date rail (`formatChangelogDate(entry.date, locale)`). Entry titles/points
  stay English by deliberate scope — they are curated data, not page copy.
- The newest entry gets the block's `badge` treatment implicitly by first
  position — keep entries sorted newest-first in the data file.
- `changelogPageMeta` (`path`/`title`/`description`) derives its English
  strings from `RESOURCE_COPY.en.changelog` — shared by both route files.
- No client JS: the timeline block is server-renderable markup; the page
  stays readable without JavaScript.
- Route wiring (metadata, breadcrumbs, `force-dynamic`) lives in
  `app/changelog/page.tsx` + `app/[locale]/changelog/page.tsx`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | `locale` prop threads `RESOURCE_COPY` chrome + localized dates through the page | Devin |
| 2026-10-10 | Created for the public `/changelog` route | Devin |
