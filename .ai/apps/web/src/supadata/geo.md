# apps/web/src/supadata/geo.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Platform geo headers (x-vercel-ip-*/cf-ip*) → {country, region, city}; `clientIp` delegates to `clientIpForRequest` with trustedProxyCount. Country lowercased, city URI-decoded at the boundary.

## Important Notes / NEVER Change

- trustedProxyCount=0 locally means XFF is ignored → ip "unknown" (attacker-controlled input never becomes identity).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Added with the supadata analytics module | Devin |
