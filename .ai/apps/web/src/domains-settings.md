# apps/web/src/domains-settings.tsx

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Client component for Settings → Domains: lists each workspace domain
with status/TLS state and the DNS records to create (CNAME to the
target, ownership TXT, DCV TXT records), Refresh-status and Remove
actions via the domain server actions, and an add-domain form with
hostname-validation errors. Renders an explanatory note instead of
controls when `CUSTOM_DOMAINS_PROVIDER=off` or the caller lacks
owner/admin. Lucide icons, token-only styles.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Initial component (phase B3) | Devin |
