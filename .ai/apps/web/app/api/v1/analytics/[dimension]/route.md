# apps/web/app/api/v1/analytics/[dimension]/route.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

GET breakdown for any supported dimension (path/hostname/source/medium/campaign/channel/referrer/country/city/browser/os/device/event), including per-bucket revenue from attributed payments.

## Important Notes / NEVER Change

- Unknown dimensions 400; the dimension allowlist lives in supadata/queries.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Added with the supadata analytics module | Devin |
