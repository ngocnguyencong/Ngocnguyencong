# src/locale-app-routes.test.ts

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

Contract tests that every key app route exists under `app/[locale]/` and
behaves like the un-prefixed route (renders the same component, redirects
`en` → canonical path, `notFound` for unsupported locales).

## Coverage

- Route presence + per-route render/redirect/notFound assertions for
  dashboard, settings, billing, chat, ai, home, feedback, etc. The localized
  dashboard is a pure redirect to canonical `/dashboard`; `?taskId`/
  `?submissionKey` recovery forwards to `/{locale}/ai`. `AiPage`/`LocaleAiPage`
  assert the console mounts `ReferenceApp`/`ProductionReferenceApp`, that
  the `en` prefix redirects to `/ai`, and that the `en` redirect preserves
  `taskId`/`submissionKey` recovery params.
- `settings section page parity` — statically compares
  `app/settings/[section]/page.tsx` and `app/[locale]/settings/[section]/page.tsx`:
  both must pass the same `WebSettingsPage` prop names and call the same
  per-section loaders under identical `raw === "<section>"` gates. Keeps
  the localized mirror from silently dropping panel props (optional props
  compile clean when omitted).
- `WorkspaceShell localized links` — asserts the exact nav link list
  ({ text, href }) for a supplied locale and for English; update both
  `toEqual` arrays when adding/removing a nav item.

2026-10-06: Inspect the shared ShellNavigation sidebar/brand/children slots instead of the removed direct aside tree. Assert actual localized accessible names as well as every destination; mobile header targets remain localized.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | Shell tree traversal made position-independent (WP1's `AppearanceSync` child shifted `ShellNavigation` off its old index); settings parity now includes the `usage` loader | Devin |
| 2026-10-13 | `en` → `/ai` case asserts `taskId`/`submissionKey` survive the canonical redirect | Devin |
| 2026-10-13 | IA correction coverage: `/ai` + `/{locale}/ai` mount the console, every `/{locale}/dashboard` redirects to `/dashboard` (recovery → `/{locale}/ai`), shell nav expects `/ai` | Devin |
| 2026-10-13 | Added settings-section parity block: prop-name set + section-loader/gate comparison between canonical and localized pages | Devin |
| 2026-09-22 | Localized home render passes `searchParams` (waitlist state) | Devin |
| 2026-09-22 | Added `/feedback` + Feedback nav link expectations | Devin |
