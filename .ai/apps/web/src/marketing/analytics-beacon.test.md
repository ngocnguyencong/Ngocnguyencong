# src/marketing/analytics-beacon.test.tsx

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

jsdom tests for `AnalyticsBeacon` + `trackEvent` — client-side consent
gating for the `local` analytics provider — using the repo's
`createRoot` + `act` harness (`IS_REACT_ACT_ENVIRONMENT`), a stubbed
`navigator.sendBeacon`, and a stubbed `fetch` fallback.

## What It Does

- Mounts nothing / sends nothing before consent, when `rejected`, or when
  `clientCaptureEnabled` is false; posts one `{kind:"pageview"}` after
  `accepted`.
- Asserts `useMarketingConsentChoice` same-tab reactivity:
  `writeConsentChoice("accepted")` arms a mounted beacon live;
  `"rejected"` disarms it and silences later `trackEvent` calls.
- Asserts `referrerHost` carries only the referrer host (URL query never
  leaks) and malformed referrers are omitted.
- Asserts the `fetch` fallback runs with `credentials: "omit"` when
  `sendBeacon` declines.
- Asserts a fully blocked `localStorage` (SecurityError on every access)
  doesn't crash and still tracks via the in-memory consent fallback.

## Dependencies

- `vitest`, jsdom environment pragma, `react-dom/client` `createRoot`;
  `next/navigation.usePathname` mocked; `./use-consent-choice`
  `writeConsentChoice` drives consent transitions.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Initial coverage (12 cases) for consent gating, reactivity, referrer host, credentials-omit fallback, blocked storage | Devin |
