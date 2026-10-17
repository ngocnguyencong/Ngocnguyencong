# src/setup-page.tsx

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

`SetupReportView` — the `/setup` checklist body. Header + summary card
(`N ready · N need action · N in demo mode · N optional`, a `role="meter"`
progress bar of ready / (ready+action+demo), and the production-readiness
line), then one `<section>` per group with icon-marked check rows.

## Important Notes

- Server-rendered — no "use client". Status icons are lucide
  (`CheckCircle2`/`AlertTriangle`/`FlaskConical`/`Circle`) `aria-hidden`
  with a `.visually-hidden` status word so screen readers get the state.
- Fix lines render env/file values in `<code>` and commands in a `<code>`
  + `SetupCopyButton` pair — works without JS (the command stays
  selectable); the button is progressive enhancement.
- `.docHref` renders as a "Guide" link — only `/docs/<real-slug>` values
  may appear (pinned by the readiness test).
- `styles.shell` is used by `app/setup/page.tsx` for the anonymous dev
  layout (status-page-style centered main panel).
- Token-only styles in `setup-page.module.css`; mobile-width safe at
  320px via wrapping fix rows.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for the /setup readiness checklist (WP3) | Devin |
