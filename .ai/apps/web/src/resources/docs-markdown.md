# resources/docs-markdown.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Markdown serialization + search-index flattening for docs/guides:
`guideToMarkdown` powers the "Copy markdown" button, and
`buildDocsIndex` produces the `DocsIndexEntry[]` the ⌘K palette filters
client-side. `sectionTableText` flattens `Section.table` to plain text.

## Important Notes / NEVER Change

- `guideToMarkdown` emits paragraphs → items → code → table per section;
  table cells escape `|` as `\|` so Markdown output stays valid.
- `buildDocsIndex.text` and `searchGuides` (content.ts) both include
  table text — keep them in sync when `Section` grows new fields.

## Change History

| Date       | Change | Author |
| ---------- | ------ | ------ |
| 2026-09-23 | `sectionTableText` + table serialization in `guideToMarkdown`; `buildDocsIndex` includes table text | Devin |

## Docs overhaul (2026-10-01)

Complete content inventory with grouped navigation, inline references, shared ranked search, a five-minute local quickstart and deliberate continuation destinations. English slugs and existing docs layout/CSS stay intact. Human-readable guide content is localized into de/es/fr; identifiers and code remain stable.
2026-10-01 user-authorized refinement: render setupSentence as a prose continuation separate from topic prev/next; three local-setup tutorials are first and marked by brand-colored lucide Zap. Preserve the existing page shell and animation.
2026-10-01: Optional continuation serializes a localized setupFlow sentence followed by a separate topic-next heading/link. One-argument callers remain supported.
