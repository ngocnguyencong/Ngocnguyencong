# docs-route.ts

## Purpose

Shared content/metadata resolution for English and locale-prefixed docs routes. Canonicals and language alternates cover the same guide in en/de/es/fr; search is noindex.

## Behavior

- Resolves guide content and trimmed, length-bounded search queries for both route families. Unknown guides return no content for the page's 404 boundary.
- English URLs retain their existing shape. Localized routes use en/de/es/fr language alternates, with English as x-default.
- Search variants collapse to the corresponding docs landing canonical and are noindex, follow.
