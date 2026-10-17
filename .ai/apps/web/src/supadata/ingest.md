# apps/web/src/supadata/ingest.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

`processEvent(raw, headers)` — the tracking write path: visitor upsert (cookie vid or dailyVisitorKey), session create/reuse at the 30-minute boundary, first-touch vs last-touch attribution fields, geo+UA+channel denormalization, pageview/custom/goal/external_link/identify handling, goal matching.

## Important Notes / NEVER Change

- visitorBase fields (lastSeenAt/language/timezone) belong on sd_visitor only — never spread them into event/session creates.
- Bots are filtered before any write.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Added with the supadata analytics module | Devin |
