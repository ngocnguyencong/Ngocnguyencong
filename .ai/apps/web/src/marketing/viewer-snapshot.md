# src/marketing/viewer-snapshot.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Per-request server resolution of the marketing header's viewer identity —
fixes the account-button flicker caused by full-page navigation emptying
the browser session cache on every marketing link click.

## What It Does

`getViewerSnapshot()` — `server-only`, wrapped in React `cache` so all
consumers in one request share a single resolution. Reads
`await headers()`, calls `getAuthSession` (`../auth-runtime`), returns
`{ signedIn: session !== null }`. Any throw → `undefined` ("unknown"),
which makes the client header fall back to its previous
pending-then-resolve behavior.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `getViewerSnapshot` | `() => Promise<ViewerSnapshot \| undefined>` | Cached per request; `undefined` = unknown |

## Dependencies

- **Internal:** `../auth-runtime` (`getAuthSession`),
  `./viewer-snapshot-types` (`ViewerSnapshot`)
- **External:** `next/headers`, `react` (`cache`), `server-only`

## Important Notes / NEVER Change

- The return type lives in `viewer-snapshot-types.ts`, a NON-server-only
  module — client components import the type from there, never from here.
- Never log identities — the catch is silent by design.
- Safe under `force-dynamic` marketing routes; outside a request scope
  `headers()` throws → `undefined`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | Created for the server-seeded header (anti-flicker) | Devin |
