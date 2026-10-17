# apps/web/src/custom-domains/local-client.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Deterministic `CUSTOM_DOMAINS_PROVIDER=local` client: marks every
hostname `active` immediately with the `customers.localhost` CNAME
target — used for development and tests without Cloudflare calls.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Initial client (phase B3) | Devin |
