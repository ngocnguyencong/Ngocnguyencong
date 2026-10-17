# authjs-signin.tsx

## 2026-09-23 — visible GitHub provider setup state

- GitHub renders disabled before setup and posts through the existing Auth.js
  social sign-in action when configured.

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Branded client sign-in surface rendered when the Auth.js engine handles
auth (credentials + OAuth provider buttons). Chrome is
`MarketingAccountShell` (header/footer + app-theme), same as
`web-auth-page.tsx`.

## What It Does

- `useActionState` wraps `authJsCredentialsSignIn` for email/password;
  `authJsSocialSignIn` backs the enabled-provider buttons (fixed
  `SOCIAL_ORDER`: github, google, microsoft, apple, twitter).
- `state.error` is a machine `AuthJsErrorCode` — one `toast.error` per
  action result via a ref-guarded effect (`toasted.current`), mapped
  through `authErrorMessage` + `copy.errors`; no inline `.form-error`.
- Social providers render first (brand marks via `SocialProviderMark`),
  then `copy.orDivider`, then the credentials form; buttons use the fixed
  `.button-icon` slot + centered `.button-label`.
- Every visible string reads the `copy` prop
  (`MessageDictionary["auth"]`) — `authjsTitle`/`authjsIntro`,
  `continueWith {provider}` via `formatTemplate`, `emailLabel`/
  `passwordLabel`/`signIn`/`signingIn`, and `authjsEngineNote` +
  `authjsEngineEnable` (split on `{setting}` via `splitTemplate` so the
  `<code>` env name keeps its markup).
- The card renders inside `<main className="auth-stage" id="main">` so it
  gets the same centered 420px card + `auth-card-enter` entrance as the
  Better Auth flow (added 2026-09-22 — previously the bare article missed
  the stage centering and stretched under the fixed header).

## Important Notes / NEVER Change

- Never import server-only auth/config modules — this file is `"use client"`.
- Keep the provider allowlist driven by the `providers` prop only.
- The error toast must fire once per result — keep the `toasted` ref
  guard so StrictMode effect replays never double-fire.

## Change History

| Date | Change | Author |
| ---- | ------ | ------ |
| 2026-09-23 | Boundary clarified: the email/password form stays — credentials is this engine's only email path and passwords here come from existing accounts/seeded users, not the removed Better Auth chooser step | Devin |
| 2026-09-23 | Full localization: title/intro/labels/buttons/engine note all read `copy`; `splitTemplate` keeps the `<code>` env-name markup inside the translated enable sentence | Devin |
| 2026-09-23 | T3 wiring: `copy`/`locale` props, `state.error` → localized toast (ref-guarded), icon slots + social-first + or-divider; inline `.form-error` removed | Devin |
| 2026-09-22 | Wrapped the card in `main.auth-stage#main` for the centered compact layout + working skip link | Devin |
