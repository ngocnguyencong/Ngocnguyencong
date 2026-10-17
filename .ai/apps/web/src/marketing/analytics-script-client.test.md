# src/marketing/analytics-script-client.test.tsx

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

jsdom tests for `AnalyticsScriptClient` — the consent-gated vendor-script
injector for the `plausible`/`posthog` providers — using the repo's
`createRoot` + `act` harness and `writeConsentChoice` to drive consent
transitions.

## What It Does

- Asserts nothing injects while undecided or after `rejected`.
- Asserts the plausible `<script defer data-domain>` is appended on
  accept (default + `ANALYTICS_HOST` origins), removed on withdrawal with
  `window.plausible` deleted, and re-injected cleanly on re-accept.
- Asserts the posthog path opts out + resets the vendor global on
  withdrawal (`opt_out_capturing`/`reset` invoked, `window.posthog`
  deleted).

## Dependencies

- `vitest`, jsdom environment pragma, `react-dom/client` `createRoot`;
  `./use-consent-choice` `writeConsentChoice`; `document.head` script
  nodes cleaned in `afterEach`.

## Important Notes

- jsdom does not execute inline scripts, so the posthog snippet's
  `window.posthog` stub never materializes — tests assign a fake global
  to exercise the teardown calls directly.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Initial coverage (5 cases) for inject/withdraw/re-inject + PostHog opt-out teardown | Devin |
