# tests/e2e/auth-steps.spec.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Chromium coverage for `/auth`: method-chooser-only choose screen,
viewport-width gates on auth + dashboard reference, and the ThemePicker →
`html[data-theme]` + CSS-variable assertion (Paper ↔ Obsidian accent/page
token values).

## Important Notes

- Radio lookups use `exact: true` ("Paper", "Obsidian") — the picker's
  longer accessible names would otherwise collide.
- The theme test navigates directly to `/settings/appearance`; the global
  15s expect timeout covers the dev-server render latency.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Chooser test rewritten for the passwordless flow: asserts no password button/field, walks magic-link-email and otp-email steps + `.auth-back` ("Choose another method") return | Devin |
| 2026-09-22 | exact:true on Paper/Obsidian radio names | Devin |
