# apps/web/src/custom-domains/provider.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Provider-neutral custom-domain client contract (`CustomDomainProvider`)
plus shared types: `CustomHostname`, `DomainVerification` (cnameTarget,
DCV records, ownership TXT), `CustomDomainStatus`
(active|deleted|failed|moved|pending). Cloudflare for SaaS is the
production implementation; `local` activates immediately.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Initial contract (phase B3) | Devin |
