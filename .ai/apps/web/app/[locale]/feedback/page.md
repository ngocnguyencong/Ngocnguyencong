# apps/web/app/[locale]/feedback/page.tsx

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Localized mirror of `/feedback`. `isAppLocale(locale)` gate → `notFound`
for unsupported locales, `redirect("/feedback")` for `en`; otherwise loads
the board and renders `WebFeatureBoardPage` with `locale` for prefixed
WorkspaceShell links.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-22 | Created localized feedback route | Devin |
