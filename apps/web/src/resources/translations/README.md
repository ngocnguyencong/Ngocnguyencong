# Documentation translations

The docs support the same `en`, `de`, `es`, and `fr` locales as the app.
`docs-copy.ts` contains interface labels; these files contain guide content.
`docs-i18n.ts` applies translations on the server. Client controls receive the
localized search index and their labels, without importing these catalogs.

The English content in `content.ts`, `additional-guides.ts`, and
`feature-guides.ts` supplies the core guide strings. `core.en.json` stores
those exact strings. Its German, Spanish, and French arrays have the same
length and order: entry `i` translates English entry `i`. Append a new source
string and its three translations together. When replacing a string, replace
all four entries at the same index. Never sort one array independently.

Provider, block, and reference translations use exact English strings as JSON
object keys. Update their corresponding maps when changing a catalog. The
complete directory is built from the guide catalog; its translated labels and
group descriptions are included in the reference maps.

The beginner revision consolidates new first-run, foundation, additional,
feature, block and reference prose in `beginners.{de,es,fr}.json`. These maps load
after the original catalogs, so an updated source string does not require
reordering the aligned core snapshots. Translate every added or changed
human-facing string; a missing entry must fail the coverage check rather than
silently passing with an English value.

Translate titles, descriptions, prose, list items, link labels, and readable
table content. Preserve slugs, section IDs, code blocks, inline code identifiers,
environment keys, source paths, and Markdown link destinations. Internal docs
URLs are qualified for the current locale by the renderer.

Check content and translations after an edit:

```sh
corepack pnpm exec vitest run apps/web/src/resources/docs-navigation.test.ts apps/web/src/resources/docs-i18n.test.ts apps/web/src/resources/docs-route.test.ts --maxWorkers=4
```

These tests catch missing readable translations, unequal core arrays, changed
code/identifiers, broken guide/section links, and invalid continuation targets.
