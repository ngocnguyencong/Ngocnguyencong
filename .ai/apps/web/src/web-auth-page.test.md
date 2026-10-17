# apps/web/src/web-auth-page.test.ts

2026-10-03: Pins the localized create-account choice and password form at the
post-OTP `set-password` step. Server-side authorization is covered by
`verified-signup.test.ts` and the Better Auth handler integration test.

## 2026-09-23 — visible GitHub setup state

- GitHub remains visible as a disabled method until OAuth is configured, so
  starter users can see the supported login path before adding credentials.

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Static-markup tests for `WebAuthPage` plus the exported `submitAuthAttempt`
helper. Mocks `web-auth-client` (`useSession` harness), `web-auth-actions`,
`toast`, and `marketing/account-shell`, then `renderToStaticMarkup`s the
component — no DOM environment needed.

## Coverage

- Pending session renders the skeleton card (`aria-busy`, visually-hidden
  `role="status"` restoring title, zero real buttons).
- Choose step orders social providers → `auth-divider` → email methods;
  divider hidden when no provider is enabled.
- `submitAuthAttempt` toasts the localized `invalidCredentials` string
  (asserted against the German dictionary), `generic` for thrown/unknown
  errors, and stays silent on success.
- The de OTP-email step (via `initialStep="otp-email"`) renders the German
  title + labels and contains none of the former English literals —
  the regression guard for the localization gap.
- The choose step contains no "password" copy; the back control renders as
  `button.auth-back` (arrow svg + label), never `.button` chrome.
- The otp-verify step (`initialStep="otp-verify"`) renders the `otp-input`
  block — six `data-otp-slot` boxes + exactly one `<input>` (the hidden
  `id="auth-otp"` field, `autoComplete="one-time-code"`) —
  plus the localized `emailCodeLabel`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Added otp-verify step case: six `data-otp-slot` boxes + single hidden `auth-otp` input via the `otp-input` block | Devin |
| 2026-09-23 | de localization test moved to `otp-email`; added no-password-chooser + `.auth-back` shape assertions; password/reset mock actions removed | Devin |
| 2026-09-23 | Added the de password-step localization test (`initialStep` seam) | Devin |
| 2026-09-23 | Created | Devin |
