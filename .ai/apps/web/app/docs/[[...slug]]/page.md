# Docs catch-all page

## Purpose

Resolves published guide slugs and GET search, renders DocsPage, returns real 404s, and owns per-guide metadata.

## Important Notes

- Await Next.js params/searchParams. Search pages are noindex and collapse to the docs canonical. Existing guide slugs stay valid.

## Locale handling

- The docs landing has its own canonical and guides retain their own URLs. Requests with a saved non-English locale redirect to that locale's docs path, preserving a string search query.
