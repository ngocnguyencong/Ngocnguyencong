# app/[locale]/dashboard/page.tsx

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

Locale-prefix shim for the analytics product: every supported locale
(`en`/`de`/`es`/`fr`) redirects to the canonical `/dashboard`; unsupported
locales `notFound`. Shared task-recovery links (`?taskId`, `?submissionKey`)
forward to the localized AI-task console at `/{locale}/ai` instead, since the
console moved off the dashboard route — the target is built by the shared
`taskRecoveryHref(query, localePath(locale, "/ai"))` helper.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-13 | `site`/`period` params forward to `/dashboard` instead of dropping | Devin |
| 2026-10-13 | Recovery forward now uses shared `taskRecoveryHref` (`src/ai-task-recovery.ts`) | Devin |
| 2026-10-13 | Reference-app mount replaced by canonical `/dashboard` redirect + `/{locale}/ai` recovery forwarding | Devin |
