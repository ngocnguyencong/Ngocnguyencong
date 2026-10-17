# ambient-background.tsx (kit block)

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Copyable canvas backdrop for heroes/auth/feature sections — five tech-vibe
`kind`s drawn with plain Canvas 2D and theme tokens only.

## What It Does

- `AmbientBackground({ kind, pauseLabel?, playLabel? })` renders an
  `aria-hidden` absolute-fill canvas (`.background`) + a pause/play control
  (hidden under `prefers-reduced-motion`, which also freezes the frame).
- Kinds: `globe` (particle sphere, pointer scatter), `rails` (S-curve lanes
  with packet pulses), `grid` (scrolling perspective floor), `constellation`
  (drifting nodes + proximity links), `matrix` (falling glyph columns).
- Lifecycle: IntersectionObserver gates the rAF loop (offscreen = idle),
  `document.hidden` pauses, DPR capped (1.5/1.75), slow frames drop `stride`
  to 2 (globe point sampling) — a proven rAF loop with no i18n import
  (labels are props per block rules).
- Colors read once per resize from the parent's computed `--accent`,
  `--text`, `--muted` — restyles with every pack.

## Open Threads / Resume Context

- **Status:** done — block + module.css + registry entry + /kit-blocks
  demo + blocks.test.ts contract test all landed (6/6 tests, typecheck
  clean).

## Agent Decisions / Thoughts

- 2026-09-23: Labels are props (`pauseLabel`/`playLabel`, English defaults)
  not dictionary lookups — blocks must copy cleanly with zero kit imports.
  Globe keeps pointer-scatter; the other kinds intentionally ignore the
  pointer so auth/section backdrops stay calm.

## Important Notes / NEVER Change

- Tokens only (`var(--*)`), no hex, no kit/product imports — see blocks.md.
- Motion must respect `prefers-reduced-motion` (static frame) and remain
  pausable; never animate layout (absolute canvas only).

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-23 | Created block with 5 canvas kinds | Devin |
