# apps/web/app/api/v1/collect/route.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Server-side event ingest for /api/v1: sd_ site key or workspace session auth, same processEvent pipeline as the beacon.

## Important Notes / NEVER Change

- Keep payload parity with /api/e.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Declare `runtime`/`dynamic` locally instead of re-exporting them — Turbopack can't statically parse re-exported segment config and the production build failed | Devin |
| 2026-10-11 | Added with the supadata analytics module | Devin |
