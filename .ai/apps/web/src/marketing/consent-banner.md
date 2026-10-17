# src/marketing/consent-banner.tsx

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

The marketing cookie/analytics consent banner — a fixed-position client
island that persists the visitor's `accepted`/`rejected` choice and
broadcasts it to mounted analytics islands.

## What It Does

- Reads the stored choice via `useMarketingConsentChoice`; stays
  unmounted until the first client effect runs so SSR never flashes a
  banner at returning visitors.
- `shouldShowConsentBanner({ clientCaptureEnabled, choice })` decides —
  the server-resolved capture flag arrives as the `clientCaptureEnabled`
  prop from `SiteFooter`/`MarketingAccountShell`.
- `choose(next)` delegates to `writeConsentChoice` (shared storage
  writer: try/catch'd localStorage + `CONSENT_CHANGED_EVENT` dispatch) so
  the beacon/script islands react in the same tab without a reload.
- `locale` prop → `copyForLocale(locale).consent` localizes
  title/body/accept/reject (en/de/es/fr); both mount points pass their
  page locale.
- `ConsentPreferencesButton` (same file): the quiet footer control that
  re-opens the banner — `writeConsentChoice(null)` clears the stored
  choice. Renders only when `clientCaptureEnabled`; label arrives as a
  prop (`copyForLocale(locale).consent.preferences`) so it localizes with
  the footer.

## Dependencies

- `@supastack/i18n` `AppLocale`, `../ui/ui-copy` `copyForLocale`,
  `./marketing-consent` (predicates), `./use-consent-choice`,
  `./consent-banner.module.css`.

## Important Notes

- `clientCaptureEnabled` is a required prop — the compile-time
  `MARKETING_CLIENT_CAPTURE_ENABLED` constant is gone; each mount point
  resolves `clientCaptureEnabledFor(resolveAnalyticsConfig())` server
  -side.
- Dismissing without choosing is not a choice — the banner returns on the
  next visit until an explicit accept/reject is stored.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | `locale` prop + `copyForLocale().consent` copy; `choose` → shared `writeConsentChoice`; new `ConsentPreferencesButton` (re-open path) | Devin |
| 2026-10-10 | Prop-driven capture flag + `CONSENT_CHANGED_EVENT` dispatch via shared consent hook | Devin |
| (earlier) | Scaffold banner behind compile-time flag | Devin |
