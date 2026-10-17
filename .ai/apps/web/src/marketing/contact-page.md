# apps/web/src/marketing/contact-page.tsx

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

`/contact` content: status banner from `leadStatusMessage`, plus the contact
and newsletter server-action forms.

## Important Notes / NEVER Change

- `turnstileSiteKey` prop renders `<CaptchaWidget>` inside each form — the
  widget auto-injects `cf-turnstile-response`; `leads-actions.ts` verifies it.
  Route (`app/contact/page.tsx`) supplies the key from `PublicConfig.captcha`
  only when `provider === "turnstile"`.
- Never invent subscriber counts (tested).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Turnstile widget in both lead forms when configured | Devin |
