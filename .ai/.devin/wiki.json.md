# .devin/wiki.json

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

DeepWiki steering file: `repo_notes` (architecture summary: apps/web
Next 16, mobile Expo, desktop Tauri shell, packages, provider-kind env
switches, workspaceId scoping, kit blocks/themes, agents+MCP, billing
adapters) plus a 30-page hierarchy covering every app/package and the
cross-cutting flows (auth, billing ledger, AI routing/budgets,
agents/MCP, custom domains, email, jobs, storage, i18n, themes/blocks,
SEO, desktop, mobile BFFs, Supabase deploy).

## Behavior

- Content is deliberately buyer-clean — `renderWikiJson` in
  `scripts/subrepos.mjs` reuses this file to emit per-repo
  `.devin/wiki.json` files containing only pages for shipped code.
- Page titles map to ship keys (`WIKI_PAGE_SHIP`); monorepo `.devin/` is
  never copied verbatim into sub-repos.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-06 | `repo_notes` billing list refreshed to all 9 adapters (+= paddle/dodo/paypal) | Devin |
| 2026-09-22 | Initial steering file (phase C3) | Devin |
