# apps/web/app/auth/page.tsx

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

`/auth` route — resolves the request origin, projects provider flags from
`parsePublicConfig(parseServerConfig())`, renders `WebAuthPage` (better-auth
engine) or `AuthJsSignIn` (`AUTH_PROVIDER=authjs`).

## Important Notes

- Passes `captchaSiteKey` only when `captcha.provider === "turnstile"`.
- `force-dynamic` — needs live headers for the request origin.
- Resolves `locale` from `LOCALE_COOKIE` → `x-supastack-locale` →
  `accept-language` (same pattern as `app/settings/[section]/page.tsx`) and
  passes `copy` (`dictionary.auth`) + `locale` to both sign-in components.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Locale resolution + `copy`/`locale` props for localized auth toasts/skeleton | Devin |
| 2026-09-22 | Pass `captchaSiteKey` through to `WebAuthPage` | Devin |
