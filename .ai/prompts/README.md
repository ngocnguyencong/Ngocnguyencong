# prompts/README.md

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

Index of the repo's prompt library: the pick-a-style → pick-blocks →
paste-a-prompt workflow, the file table, and the standing "Rules of the
game" every styling prompt repeats (token-only styling, kit blocks over
bespoke patterns, `data-layout` axis for chrome, `MARKETING_THEME_MODE`
one-liner for marketing identity).

## What It Does

- Opens with a workflow paragraph; now notes `agent-setup.md` as the
  zero-to-running on-ramp to paste before the styling prompts.
- Prompt table in logical order — `agent-setup.md` first (stand the kit up
  + deploy), then `pick-a-style.md`, `new-landing-page.md`,
  `new-app-screen.md`, `restyle-product.md`, `ui-audit.md`.
- "Rules of the game" section stays untouched — it documents the standing
  constraints (consume `var(--*)` tokens, prefer registered blocks, chrome
  via the layout axis, marketing mode via one line).

## Important Notes / NEVER Change

- Table order is deliberate, not alphabetical: setup on-ramp first.
- Keep table rows aligned with files actually present in `prompts/` —
  adding a prompt means adding its row and its `.ai/prompts/` mirror doc.

## Change History

| Date       | Change                                                              | Author |
| ---------- | ------------------------------------------------------------------- | ------ |
| 2026-10-16 | Intro paragraph += `/setup` readiness checklist as the first in-app stop after `agent-setup.md` stands the kit up | Devin |
| 2026-10-06 | Backfilled `.ai/prompts/` mirrors for `new-app-screen.md`, `new-landing-page.md`, `restyle-product.md`, `ui-audit.md` | Devin  |
| 2026-10-06 | `agent-setup.md` row added first + intro on-ramp line; initial mirror | Devin  |
