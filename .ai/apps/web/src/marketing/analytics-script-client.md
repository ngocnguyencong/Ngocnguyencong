# src/marketing/analytics-script-client.tsx

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Consent-gated third-party analytics injector for the `plausible` and
`posthog` providers. Renders/injects nothing until the visitor's consent
resolves to `accepted`; a later accept injects without a reload.

## What It Does

- `plausible` → appends `<script defer data-domain={siteId}
  src="{host ?? https://plausible.io}/js/script.js">`.
- `posthog` → appends the official posthog-js loader snippet (installs
  the `window.posthog` queue stub, lazily pulls `static/array.js` from
  `api_host`) then `posthog.init(siteId, { api_host: host ??
  https://us.i.posthog.com })` — no npm dependency.
- One-shot via `injectedRef`; `rejected`/undecided states inject nothing,
  ever.
- Consent withdrawal after injection runs the effect cleanup: plausible
  removes the `<script>` node + `delete window.plausible`; posthog calls
  `opt_out_capturing()` + `reset()`, removes the loader, and deletes
  `window.posthog` — all vendor-global access in try/catch (globals may
  be absent/blocked). `injectedRef` resets so re-acceptance re-injects
  cleanly.

## Dependencies

- `react`, `./marketing-consent` `canCaptureAnalytics`,
  `./use-consent-choice` `useMarketingConsentChoice`.

## Important Notes

- `ANALYTICS_HOST` overrides the vendor origin (self-hosted Plausible /
  PostHog reverse proxy) — config enforces https.
- The snippet runs client-side only inside a consent-gated effect; no CSP
  ships in the kit today, but adding one must whitelist the vendor
  origin + inline loader.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Effect cleanup tears down on consent withdrawal (opt_out+reset / script removal + global delete); vendor globals guarded by try/catch | Devin |
| 2026-10-10 | Initial injector (plausible + posthog snippet) | Devin |
