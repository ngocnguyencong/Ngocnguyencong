# apps/web/app/share/[shareId]/page.tsx

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Public read-only dashboard resolved by sd_site.share_id (share slug "demo" for the seeded site). generateMetadata renders `robots: noindex` — crawlable but unindexed since it is user-generated content.

## Important Notes / NEVER Change

- No auth; period picker only (24h/7d/30d/90d).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Added with the supadata analytics module | Devin |
