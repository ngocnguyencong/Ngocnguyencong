# src/marketing/site-header-client.tsx

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Interactive marketing header — split out of `site-header.tsx` on 2026-10-16
so `site-header.tsx` can be an async server component that resolves the
viewer once per request and seeds this client's first render.

## What It Does

`SiteHeaderClient({ active?, locale?, viewer? })` — identical to the
pre-split `SiteHeader`: brand wordmark, `siteConfig.navigation` desktop and
`<dialog>` mobile nav (WAAPI animation, reduced-motion instant finish),
`LanguageSwitcher`, session-aware primary CTA (`/dashboard` +
`auth.returnToDashboard` when signed in, else `/auth` + `nav.getAccess`),
`noscript` fallbacks, `FaqWidget`.

New behavior vs the pre-split component:

- `viewer?: ViewerSnapshot` (`{signedIn: boolean}` from
  `viewer-snapshot-types.ts`). `signedIn` derives as
  `live !== undefined ? live !== null : viewer?.signedIn`; `ready` is
  `signedIn !== undefined`. While the client session is unresolved the
  snapshot supplies the answer; once the session resolves (or a confirmed
  browser cache exists) the live value wins — a resolved guest replaces a
  stale signed-in snapshot.
- Both `<noscript>` blocks use `noscriptPrimary` — `/dashboard` +
  `auth.returnToDashboard` when `viewer.signedIn`, otherwise the old
  `/auth` + `nav.getAccess` (unknown snapshot keeps the previous markup).

## Props / Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `active` | `MarketingSection` | No | Current section; rewrites `#anchor` hrefs to `/…` |
| `locale` | `AppLocale` | No | Defaults to `"en"` |
| `viewer` | `ViewerSnapshot` | No | Server-resolved snapshot; `undefined` = unknown → old pending behavior |

## Important Notes / NEVER Change

- Keep `"use client"` — dialog animation, scroll listener, session hook.
- `exactOptionalPropertyTypes` is on: props declare `| undefined` because
  the server wrapper passes possibly-undefined values.
- Do not import `viewer-snapshot.ts` here — it is `server-only`; the shared
  type lives in `viewer-snapshot-types.ts`.
- `MarketingAccountShell` uses this component directly (auth pages are
  client components that cannot mount the async server wrapper).

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | Split out of `site-header.tsx`; gained optional `viewer` prop + snapshot-aware noscript links | Devin |
