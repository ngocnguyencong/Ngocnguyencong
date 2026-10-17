# apps/web/src/social-provider-marks.tsx

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

`<SocialProviderMark provider>` — 16px inline-SVG brand marks for the
social sign-in buttons: the official four-color Google "G", the
four-square Microsoft logo, and `currentColor` GitHub / Apple / X marks.

## Important Notes / NEVER Change

- Decorative: the component renders `aria-hidden`; the accessible name
  comes from the button label.
- Google keeps its four official colors (it must not be flattened to
  `currentColor`); the other marks inherit `currentColor`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Doc created; component wired into `web-auth-page` + `authjs-signin` (T3) | Devin |
