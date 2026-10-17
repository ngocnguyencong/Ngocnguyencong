# docs-navigation.test.ts

## Purpose

Tests complete grouping, stable guide URLs, source inventory coverage, linked destinations and consistent relevance ranking across server/client search.

## Coverage

- Shipped feature/platform pages, every registered block's files, example environment keys, every API route and its methods, executable buyer-safe snippets, resolvable links/anchors and ranked multiword search.

## Behavior

- Resolve repository-level `.env.example` and API route paths relative to this test file so inventory checks work from Vitest's `apps/web` working directory.
- Derive route names relative to the resolved `apps/web/app/api` root; verify every handler's exported method against its `/api/...` reference row.

2026-10-02: Formatting normalized during final documentation checks; content and structural identifiers preserved.
