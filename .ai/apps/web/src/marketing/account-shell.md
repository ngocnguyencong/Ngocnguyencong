# apps/web/src/marketing/account-shell.tsx

## Purpose
Shared marketing shell for auth and account pages: skip link,
`SiteHeaderClient` (rendered directly — the auth pages are client
components and cannot mount the async server `SiteHeader` wrapper),
marketing theme attributes — no `SiteFooter` (auth stays focused on the
form). `ConsentBanner` still mounts (fixed-position overlay, not part of
footer layout) so first-time visitors landing on `/auth` keep the analytics
consent choice.

## Current work
Auth shell must apply the configured marketing theme attributes, as the homepage does. The missing attributes let app theme selection recolor account pages.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | Renders `SiteHeaderClient` — async server `SiteHeader` cannot mount inside the client auth pages | Devin |
| 2026-10-11 | `ConsentBanner` receives `locale ?? "en"` for localized banner copy | Devin |
| 2026-10-10 | `ConsentBanner` gets `clientCaptureEnabled` from `clientCaptureEnabledFor(resolveAnalyticsConfig())` — consent prompts reflect the configured provider; the beacon/script stay on `SiteFooter` only | Devin |
| 2026-10-09 | `SiteFooter` removed from auth chrome; bare `ConsentBanner` kept so consent still prompts on `/auth`-first sessions | Devin |
