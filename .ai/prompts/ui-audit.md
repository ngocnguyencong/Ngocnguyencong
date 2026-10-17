# prompts/ui-audit.md

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

Pasteable prompt that audits `<route or component>` for visual quality,
accessibility, and theme-system fit — reports findings ordered by
severity, then fixes only what the user approves (or everything when
told).

## What It Does

- Defers to the installed design skills named in `AGENTS.md`
  (`impeccable`, `better-interface`, `web-design-guidelines`; `better-*`
  subskills by domain).
- Checklist: tokens (hardcodes that should be `var(--*)`, anything that
  breaks under another pack or `data-layout`), accessibility (contrast in
  light + dark packs, visible focus, labels, ≥44px hit targets, reduced
  motion, keyboard path, 320px wrap), layout (alignment, spacing rhythm,
  reading order, truncation, widows at 1440px + 390px), icons
  (`lucide-react`, `aria-hidden`, `currentColor`), and chrome fit (app
  shell / marketing surface vs one-off CSS).
- Requires verification in the browser on the dev server — no code-only
  audits.

## Important Notes / NEVER Change

- Approval-gated fixes are the point: report first, edit only what the
  user approves.
- Keep the checklist aligned with the `AGENTS.md` visual-skill rules it
  delegates to.

## Change History

| Date       | Change             | Author |
| ---------- | ------------------ | ------ |
| 2026-10-06 | Initial mirror doc | Devin  |
