# apps/web/app/api/e/route.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Public tracking beacon hit by public/sd.js: POST a single event through processEvent with PUBLIC_CORS. Anonymous — keyed by the sd_ site key in the payload.

## Important Notes / NEVER Change

- Rate-limited like other public endpoints; bots filtered inside processEvent.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Added with the supadata analytics module | Devin |
