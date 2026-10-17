# apps/web/app/layout.tsx

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Root layout: `<html lang="en">` + theme stylesheet + FOUC boot script
in `<head>`, JsonLd + `{children}` + `<Toaster />` in `<body>`.

## Important Notes

- Render all default style attributes directly on `<html>` so the configured
  bundle works without JavaScript and when storage is blocked. The boot script
  restores explicit saved visitor preferences before paint.
- `THEME_BOOT_SCRIPT` (from `src/theme/theme-boot.ts`, server-only)
  stamps `data-theme` + all `data-*` preset attributes before paint —
  contract test guards the boundary.
- `<Toaster />` mounts the global toast viewport at body level with
  no props — it self-localizes its dismiss label from the locale
  cookie post-hydration.
- `lang="en"` is static here; localized routes re-set `lang` deeper
  (see `src/marketing/locale-html-lang.ts`).
- `openGraph.images` and `twitter.images` both reference `[rootOgImage]`.
  Segment-level social metadata replaces those objects wholesale, so public
  pages with overrides must supply their image explicitly.

## Default Description

- The default description identifies the boilerplate demo for all three app
  surfaces and matches the web manifest. Keep request-aware branding and social
  image behavior intact.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Explicit static `/demo-social.png` on root OG and Twitter metadata | Codex |
| 2026-09-24 | Dropped literal `title`/`description` from layout `openGraph`/`twitter` — they blocked Next's per-page autofill, stamping the generic brand onto every card (e.g. `/faq` now emits `og:title="FAQ | supastack"`). siteName/type/locale/card remain. | Devin |
| 2026-09-22 | Static `metadata` → request-aware `generateMetadata` (hostname-specific brand title) | Devin |
| 2026-09-22 | Mounted global `<Toaster />` | Devin |

## UI foundation implementation (2026-10-06)

Shared accessible Select/Popover/Dialog behavior is integrated where applicable; shared chrome and appearance labels are localized. Workspace scope, server-authoritative actions, neutral sample content, and native form/essential reading fallbacks are preserved. Behavioral verification covers the shared primitives; live authenticated/provider flows remain outside local acceptance.
