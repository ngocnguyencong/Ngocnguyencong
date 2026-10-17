# apps/web/src/custom-domains/hostname.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Pure hostname validation for workspace custom domains: trim/lowercase,
strip trailing dot, `domainToASCII`; rejects IPs, localhost, wildcards,
ports/paths/credentials, >253 chars, <2 labels, the app's own host
(derived from `APP_URL`) and its subdomains, and the CNAME target itself.
Returns a typed `CustomHostnameRejection` the UI maps to copy.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Initial validation (phase B3) | Devin |
