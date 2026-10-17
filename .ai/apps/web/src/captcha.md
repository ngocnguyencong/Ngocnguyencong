# apps/web/src/captcha.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Server-only bot-protection boundary for public, unauthenticated endpoints
(lead forms today; auth endpoints via the better-auth `captcha` plugin).

## What It Does

- `CaptchaVerifier.verify(token, remoteIp?)` — true = human or captcha off.
- `createTurnstileVerifier({ secretKey, fetchImpl?, verifyUrl? })` — POSTs
  `secret`/`response`/`remoteip` to Cloudflare siteverify, 10s abort, **fails
  closed** on missing token, non-200, `success:false`, or network error.
- `createCaptchaVerifier(providers.captcha, deps?)` — `off` → always-pass;
  `turnstile` → siteverify. `deps.fetchImpl` is the test seam.
- `getCaptchaVerifier()` — process-wide singleton reading `parseServerConfig()`.

## Important Notes / NEVER Change

- Fail closed is deliberate — an unverifiable token is not proof of humanity.
- Server-only: reads `TURNSTILE_SECRET_KEY`; never expose it via PublicConfig
  (only `turnstileSiteKey` is public).
- Token is the `cf-turnstile-response` form field / `x-captcha-response`
  header (better-auth plugin convention). Tokens are single-use.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Added verifier boundary + Turnstile impl for lead forms/auth | Devin |
