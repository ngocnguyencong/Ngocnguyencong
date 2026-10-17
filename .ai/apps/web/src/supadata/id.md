# apps/web/src/supadata/id.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Id/key minting: `sdSiteId`/`sdShareId`/`sdId`/`newSiteKey` (returns plaintext key + display prefix + sha256 hash once), `sha256`, `dailyVisitorKey` (cookieless hash of siteId+ip+ua+UTC day).

## Important Notes / NEVER Change

- Never store site keys plaintext — hash only.
- `dailyVisitorKey` rotates at UTC midnight by design.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Added with the supadata analytics module | Devin |
