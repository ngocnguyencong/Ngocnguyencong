# prompts/restyle-product.md

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

Pasteable prompt that re-themes `<route or component>` onto the kit token
system so it restyles with every pack, preset, and layout; the
`<what's wrong>` placeholder names the current problem (hardcoded colors,
one-off CSS, fixed layout).

## What It Does

- Inventory first: every hardcoded color, px-sized spacing duplicating a
  token, and any selector fighting `.app-theme` or `.marketing-theme`.
- Replaces hardcodes with the `var(--*)` token list (`--page`, `--raised`,
  `--accent`, `--radius-*`, `--font-*`, `--space-*`, …); swaps
  re-implemented sections for real `apps/web/src/kit/blocks/` blocks.
- Keeps explicit product choices via the supported pin —
  `data-theme="<pack>"` on the wrapper — rather than hardcoded values.
- Verification: screenshots under at least two packs (e.g. Obsidian +
  Paper) and both `data-layout` variants for app screens — light and dark
  must both be legible; `pnpm check` green; contract tests updated
  deliberately when pinned behavior changes.

## Important Notes / NEVER Change

- "Deliberately, not silently" on contract-test edits mirrors the standing
  rule in `pick-a-style.md` — keep it.
- The prompt is web-surface only; all referenced paths live under
  `apps/web`.

## Change History

| Date       | Change             | Author |
| ---------- | ------------------ | ------ |
| 2026-10-06 | Initial mirror doc | Devin  |
