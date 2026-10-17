# packages/supadata-sdk/src/index.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

`SupadataClient` — typed zero-dependency server-side client mirroring the
`/api/v1` route surface (overview/timeseries/realtime/insights/breakdown/
funnelResults/visitors/payments/identify/sites + resource listers).
`sd_*` site key or `sk_*` workspace key + `siteId`.

## Important Notes / NEVER Change

- Zero runtime deps; `exactOptionalPropertyTypes`-safe (`undefined` vs `null` on fetch body).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Added with the supadata analytics module | Devin |
