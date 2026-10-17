# apps/web/src/captcha-widget.tsx

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Client island that renders a Cloudflare Turnstile widget.

## What It Does

- `<CaptchaWidget siteKey onToken? theme?>` — loads
  `turnstile/v0/api.js?render=explicit` once per document, explicit-renders into
  its div, removes the widget on unmount.
- Inside a `<form>` the widget auto-injects the `cf-turnstile-response` hidden
  input — server actions read it with no extra wiring (contact/newsletter).
- `onToken(token | null)` gives fetch-based callers (auth client) the token;
  null on expiry/error.
- `ref` (`CaptchaWidgetHandle.reset()`) re-arms the widget after each submit —
  Turnstile tokens are single-use.

## Important Notes / NEVER Change

- Script is deduped via `script[data-captcha="turnstile"]`; a short poll covers
  cached-load races where the `load` listener misses.
- Render is gated on `container.isConnected` and a stored widget id — React
  strict-mode double-mount must not double-render.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Added Turnstile widget for lead forms + auth page | Devin |
