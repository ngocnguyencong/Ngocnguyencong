# src/marketing/marketing-consent.ts

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

Marketing-consent domain model: the storage key, consent-change event
name, choice type, and the pure predicates every consent surface (banner,
beacon, script injector) shares.

## What It Does

- `CONSENT_STORAGE_KEY = "supastack-marketing-consent"` — the localStorage
  slot for the persisted `accepted`/`rejected` choice.
- `CONSENT_CHANGED_EVENT = "supastack:marketing-consent"` — same-tab
  broadcast the banner dispatches after persisting (`storage` events only
  reach other tabs).
- `clientCaptureEnabledFor(analytics)` — config-driven capture gate:
  `local` always qualifies; `plausible`/`posthog` qualify only with an
  `ANALYTICS_SITE_ID`; `off` never does. Replaces the old compile-time
  `MARKETING_CLIENT_CAPTURE_ENABLED = false`.
- `shouldShowConsentBanner({ clientCaptureEnabled, choice })` — banner
  only when capture is enabled and no choice is stored.
- `canCaptureAnalytics({ clientCaptureEnabled, choice })` — capture only
  when enabled AND `accepted`.

## Dependencies

None — pure functions + constants, safe for server and client bundles.

## Important Notes

- The consent split is deliberate: `clientCaptureEnabled` is a
  per-request server value passed down as a prop; `choice` is
  client-side localStorage read via `useMarketingConsentChoice`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-10 | `clientCaptureEnabledFor` gate + `CONSENT_CHANGED_EVENT`; `MARKETING_CLIENT_CAPTURE_ENABLED` constant removed in favor of per-request config | Devin |
| (earlier) | Scaffold: storage key + consent predicates | Devin |
