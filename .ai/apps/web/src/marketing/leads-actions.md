# apps/web/src/marketing/leads-actions.ts

> Last updated: 2026-09-21 | Protection: STANDARD

## Purpose

Server actions for the marketing contact + newsletter forms. Parse
FormData → `submitLead` → redirect back to `/contact?status=…` (status
drives `leadStatusMessage` copy). `formString` guards against File
values in FormData.

## Important Notes

- `leadSubmissionAllowed` checks a per-client bucket when the configured
  trusted proxy chain yields a client IP, then the shared
  `marketing-lead-global` bucket. Untrusted or missing forwarding chains skip
  the client bucket but retain the aggregate limit.
- Wires both optional sinks each submit: `store: await getLeadStore()`
  (env-selected lead persistence) and `inbox`/`send` (MARKETING_INBOX
  notification mail). With neither configured the action redirects with
  `delivery-not-connected`.
- `getLeadStore` is async — the firestore impl dynamic-imports
  firebase-admin; call it inside the action, never at module scope.
- Both actions first pass `captchaOk()`: `getCaptchaVerifier().verify()`
  on the `cf-turnstile-response` field (remoteip from `x-forwarded-for`).
  Failure redirects with `status=captcha`. No-op unless
  `CAPTCHA_PROVIDER=turnstile`.

## Change History


| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Turnstile gate ahead of parse/submit on both actions | Devin |
| 2026-09-21 | Pass `store: await getLeadStore()` into `submitLead` for both actions | Devin |

## Security Fix (2026-09-27)

Both public server actions check the global bucket (100/hour) after validation and before storage or mail. A denied request redirects to rate-limited status. CAPTCHA remains optional.

## Security Fix (2026-10-03)

Both actions also use the same trusted-proxy-derived client bucket as waitlist
joins (5/hour). No untrusted leading XFF entry or `x-real-ip` value is treated
as a client identity; when no trusted chain is configured, the shared global
bucket continues to protect writes without collapsing every visitor into a
small unknown-IP quota.
