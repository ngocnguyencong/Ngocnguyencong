# apps/web/src/custom-domains/runtime.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Server-only composition for custom domains: builds the provider client
from `serverConfig.customDomains` (`off|local|cloudflare` — off
degenerates every export to a no-op), and `getRequestBrand()` which maps
the request `Host` header through `resolveWorkspaceByHost` to a
`ChromeBrand` (`{ name, logoUrl }`) falling back to `siteConfig` for the
platform's own hostnames. Route handlers call it and pass `brand` down
through `WorkspaceShell`/`AppBrand`, the auth card, and the root
layout's `generateMetadata` document title.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Initial runtime (phase B3) | Devin |
