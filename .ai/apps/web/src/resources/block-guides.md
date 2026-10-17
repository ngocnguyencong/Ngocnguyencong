# block-guides.ts

## Purpose

One public guide per registered copyable kit block. The registry supplies the name, description, surface and complete source-file list; the guide adds a source-backed usage example, exported component/props reference, and composition notes.

## Important Notes

- `blockGuides` is derived from `KIT_BLOCKS`, so guide metadata and coverage follow the registry instead of duplicating names or descriptions.
- Every guide has the stable slug `components/{id}` and four sections: `usage`, `props`, `files`, and `composition`.
- Usage examples include their component imports and any icon imports, plus inline demonstration data so no demo fixture is left undefined. Prop references include the exported component signature and the supporting exported aliases used in the declaration.
- The `files` section uses each registry entry's complete `files` list. Group labels come from the registry surface: marketing, app, or chrome.
- The composition notes describe these blocks as presentation-only UI. Product pages remain responsible for data loading, form processing, persistence, and authorization.
- Source-string maps live at `apps/web/src/resources/translations/blocks.{de,es,fr}.json`. Each map has 102 exact English keys covering block names/descriptions, surface groups, section titles, shared explanatory copy, and link labels. Code, ids, slugs, hrefs, component/prop identifiers, and source paths remain unchanged.
- UI layout and CSS are outside this resource's scope. `/kit-blocks` remains a development preview; these entries are public documentation only.

## Open Threads

- **Status:** implemented locally
- **Intent:** explain how to preview a block, where example code belongs, how to ask an agent to insert it, and how to verify the resulting route; preserve source-backed examples and props.
- **Result:** 43 registry-backed block guides, with four sections per guide and complete file-list coverage.
- **Verification:** registry coverage, source-string translation coverage, canonical metadata, and sitemap coverage are checked; the German, Spanish, and French maps each have 102 source keys.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-09 | `scroll-end-cta` guide + `site-footer` reference updated for the new `controls` prop — registry coverage stays enforced by the `blockGuides` throw on a missing `blockReferences` entry | Devin |
| 2026-10-06 | product-grid usage example `sub` reworded ("shop or catalog landing") — the shipped-resources banned-term scan rejects merchant-side vocabulary | Devin |
| 2026-10-01 | Added all registry-backed kit-block guides and complete German, Spanish, and French source-string maps | Codex |

## 2026-10-06 foundation blocks
Includes complete master/detail, toolbar, and pagination API/usage references plus locale strings; preserve stable generated component slugs, file lists, canonical metadata, and sitemap coverage.
