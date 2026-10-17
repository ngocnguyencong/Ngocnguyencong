# src/setup-page.module.css

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Token-only styles for the `/setup` checklist: the anonymous `.shell`
centered column, summary card + progress meter (`.track`/`.fill`), group
sections, check rows, status-icon tones (`--accent`/`--danger`/
`--warning`/`--muted`), and the fix-line `<code>` chips + copy button.

## Important Notes

- Uses design tokens only — every color pack repaints the page.
- `.fill` width is set inline from the percent; the class only owns color
  and the (reduced-motion-aware) transition.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for the /setup readiness checklist (WP3) | Devin |
