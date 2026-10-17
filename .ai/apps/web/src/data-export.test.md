# apps/web/src/data-export.test.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Coverage for `data-export.ts` — GDPR-style per-user export.

## Coverage

- Connected accounts — selects only non-secret columns; can never emit
  `token_*` material; rows scoped to the user's workspaces; external ids
  masked like the settings UI.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
