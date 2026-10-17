# app/[locale]/ai/page.tsx

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

Localized mirror of the AI-task console for `de`/`es`/`fr`. Validates `locale`
via `isAppLocale` (`notFound` otherwise), redirects the English prefix to the
canonical `/ai` — preserving `?taskId`/`?submissionKey` recovery params via
`taskRecoveryHref` — then mounts the same `ReferenceApp`/`ProductionReferenceApp`
split as `app/ai/page.tsx` with `locale` threading and a locale-qualified
GitHub callback `${origin}/${locale}/ai`. `force-dynamic`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-13 | `en` → `/ai` redirect preserves `taskId`/`submissionKey` via `taskRecoveryHref` | Devin |
| 2026-10-13 | Replaced the `/chat` redirect with the localized console mount | Devin |
