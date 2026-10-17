# apps/web/src/format.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Client-safe string-template helpers: `formatTemplate` renders
`{placeholder}` variables, `splitTemplate` splits a template on a single
placeholder so JSX (e.g. `<code>`) can sit in the slot.

## Important Notes / NEVER Change

- Must stay free of locale-file imports so client islands can use it
  without pulling every translation into the browser bundle.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | +`splitTemplate` (prod-ready-kit merge) — splits around a placeholder, no-prototype-member substitution | Devin |
| 2026-09-23 | Created for the localized auth card (web-auth-page + authjs-signin consume it) | Devin |
