# apps/web/src/marketing/locale-html-lang.tsx

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Client component that syncs `document.documentElement.lang` to the active
locale on mount. Mounted inside `LandingPage` (localized home) and inside
`ResourceShell` — so `/de`, `/es`, `/fr` homes and every localized
docs/changelog/roadmap/api-reference page report the right `<html lang>`
to AT/SEO tools.

## Important Notes

- Root `app/layout.tsx` hardcodes `<html lang="en">` and App Router gives child
  segments no server-side way to change it — this post-hydration sync is the
  pragmatic fix; `suppressHydrationWarning` is already set on `<html>`.
- SEO signal for localized pages is carried by `alternates.languages`
  (hreflang) in `[locale]/page.tsx` metadata, not by this attribute alone.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Mirror note: now also mounted by `ResourceShell` for localized resource pages | Devin |
| 2026-09-21 | Initial component for locale `<html lang>` sync | Devin |
