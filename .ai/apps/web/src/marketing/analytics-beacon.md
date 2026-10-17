# src/marketing/analytics-beacon.tsx

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

First-party analytics beacon for `ANALYTICS_PROVIDER=local` — posts
pageviews (and `trackEvent` custom events) to `/api/analytics/collect`
after consent is accepted.

## What It Does

- `AnalyticsBeacon` (client island): on mount and on every `usePathname`
  change while `canCaptureAnalytics` holds, posts
  `{ kind:"pageview", path, referrerHost }` where `referrerHost()` sends
  only `new URL(document.referrer).host` (omitted on malformed/empty
  referrers) — `navigator.sendBeacon` first, `fetch(keepalive,
  credentials:"omit")` fallback; failures swallow silently.
- `trackEvent(name)` export: under a script provider forwards to the
  loaded vendor global (`posthog.capture`/`plausible`); under `local`
  posts `{ kind:"event", name, path }`; no-ops during SSR, on blank
  names (>120 chars trimmed), and before `accepted` consent. The consent
  read + vendor-global access sit inside try/catch so blocked storage or
  blocked third-party scripts can't crash the page.
- `beaconArmed` module flag flips off the moment consent leaves
  `accepted` so late `trackEvent` calls go nowhere.

## Dependencies

- `next/navigation` `usePathname`; `react`; `./marketing-consent`;
  `./use-consent-choice`.

## Important Notes

- No cookies, no client identifiers — the server derives the
  daily-rotating `visitorHash` from the request. The fetch fallback also
  sends `credentials: "omit"` so first-party cookies never ride along
  (sendBeacon can't omit; it only fires on the cookie-free collect path).
- Only the referrer host leaves the page; the server also re-normalizes
  to a bare hostname before storage so query strings can never carry
  identifiers into a row.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | `referrerHost()` sends host-only (try/catch omit); fetch fallback `credentials:"omit"`; `trackEvent` storage/vendor access wrapped in try/catch | Devin |
| 2026-10-10 | Initial beacon + `trackEvent` helper | Devin |
