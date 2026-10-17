# consent-banner.module.css

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Styles for `consent-banner.tsx`: the fixed bottom-right `.banner` dialog
(token-only `--raised`/`--border`/`--text` card), `.actions` accept/reject
buttons (last-child is the filled primary), and `.preferences` — the
quiet text-only footer control that re-opens the banner.

## Notes

- `.preferences` deliberately matches footer-link grammar (`--muted`,
  0.9rem, color-shift hover) rather than button chrome — keyboard users
  get a `--border-strong` focus-visible outline.
- `.actions` transitions are gated; reduced motion strips transitions.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | `.preferences` text-control class for `ConsentPreferencesButton` | Devin |
| (earlier) | Banner + actions styles | Devin |
