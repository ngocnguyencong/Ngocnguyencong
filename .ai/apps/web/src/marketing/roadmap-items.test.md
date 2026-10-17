# apps/web/src/marketing/roadmap-items.test.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Guard tests for `roadmap-items.ts`: every item has a non-empty
title/description and a status in the `RoadmapStatus` union, all three
statuses are represented at least once, no promised dates slip in, and
`groupRoadmapItems` orders shipped → in_progress → planned with correct
`ROADMAP_STATUS_LABELS` labels and drops empty groups.

## Important Notes

- Pure data assertions — no imports beyond the items module.
- The no-promises regex (`Q1-4 YYYY`, `ETA`, `by <month> <year>`,
  `coming soon`) keeps the curated list neutral — mirror of the
  deliberate no-dates rule on the data itself.
- Status-vs-changelog drift is a human audit, not automatable here:
  when a changelog entry announces a feature, move its item to
  `shipped` in the same change.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Mirror corrected: tests cover `groupRoadmapItems` + labels (no `ROADMAP_STATUSES` export exists) | Devin |
| 2026-10-10 | Created alongside `/roadmap` page | Devin |
