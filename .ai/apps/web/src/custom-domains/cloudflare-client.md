# apps/web/src/custom-domains/cloudflare-client.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Fetch-based Cloudflare Custom Hostnames client:
`POST/GET/DELETE /client/v4/zones/{zone}/custom_hostnames[/id]` with
`{ hostname, ssl: { method: "txt", type: "dv", settings: { min_tls_version: "1.2" } } }`.
Maps `status`, `ssl.status`, `ownership_verification`, and
`ssl.validation_records` onto `CustomHostname`; verification data is kept
as JSON so future Cloudflare shapes need no schema change. The API token
is never logged; Cloudflare errors surface as safe messages.
Each request has a ten-second abort deadline covering response reading, so
domain creation cannot hold its workspace transaction indefinitely on a provider.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Initial client (phase B3) | Devin |
