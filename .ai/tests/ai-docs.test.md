# tests/ai-docs.test.ts

> Last updated: 2026-10-03 | Protection: STANDARD

## Purpose

Verify that the `.ai/` entry documents exist, all Markdown mirrors stay scoped to this repository, and shipped buyer-facing docs resources stay free of private-org or maintainer-only terms.

## Important Notes / NEVER Change

- Preserve banned-term detection and the bounded timeout for traversing the mirror tree.
- 2026-10-06: `BANNED_TERM` gained the private GitHub org names and the fixed remote name once hardcoded into shipped guide copy; a second describe scans shipped `apps/web/src/resources/**` (`*.ts(x)`/`*.json`) for the same list — guards the `web/upgrading` guide regression where a private monorepo URL shipped verbatim in four locales.
- 2026-10-03: Normalize existing test formatting with the repository's Prettier version before publishing; assertions and timeout behavior are unchanged.
