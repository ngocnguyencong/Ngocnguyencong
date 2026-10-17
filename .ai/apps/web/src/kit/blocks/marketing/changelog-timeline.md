# changelog-timeline (marketing block)

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Copyable release-timeline block (`changelog-timeline.tsx` +
`changelog-timeline.module.css`): an `<ol>` of entries on a rail + body
grid with a vertical spine — the classic changelog/roadmap pattern.

## What It Does

- `ChangelogEntry` props: `meta` (rail top line — release date or a
  roadmap eyebrow like "Coming soon"), `tags` (rail secondary lines —
  framework tags or "Roadmap"), `badge` (pill above the title, e.g.
  "Latest"), `title`, `kind` (accent line — "New"/"Improved"/"Fixed"),
  `summary` (intro paragraph), `points` (bullet list of shipped changes),
  `items` (`{title, body}` titled paragraphs — roadmap-style upcoming
  work), `more` (trailing muted line), `upcoming` (hollow accent-ring
  timeline dot instead of a filled one).
- Spine is `.list::before`; per-entry dots are `.entry::before`;
  `:first-child` is accent-filled (keep entries sorted newest first),
  `[data-upcoming="true"]` overrides to a hollow accent ring.
- Mobile ≤679px hides spine/dots, collapses to one column, tags wrap.

## Important Notes

- Tokens only (`--page`, `--border`, `--muted`, `--text`, `--accent`,
  `--accent-ink`, `--max`, `--gutter`, `--space-section`) — no hex, no kit
  imports; copy + props is the whole contract.
- No icon slots — framework marks are a caller concern (products render
  their own mark components in the rail).
- Registered in `src/kit/blocks.ts`; demoed on dev-only `/kit-blocks`
  (upcoming entry + two shipped entries).

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-23 | Created — rail+body timeline with upcoming/roadmap variant | Devin |
