# resources/resource-pages.test.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Render + data tests for the resources server components — currently the
`Sections` table renderer and the `posts` table-shape invariant.

## Notes

- Uses `createElement` + `renderToStaticMarkup` (vitest `include` covers
  `.test.{ts,tsx}` — widened 2026-09-23 for `otp-input.test.tsx` — but the
  convention stays `.test.ts` + `createElement`) and mocks `server-only`
  because `resource-pages.tsx` imports `seo.tsx` which is `"server-only"`.
- Asserts `<th scope="col">`/`<th scope="row">` semantics, the focusable
  `role="region"` scroll wrapper (`aria-label` = "{title} table"), the
  `accentCell` count for `accentColumn`, and that a named corner cell
  keeps column 0 as plain `<td>`.

## Change History

| Date       | Change | Author |
| ---------- | ------ | ------ |
| 2026-09-23 | Created with the `Section.table` feature | Devin |

## Content update (2026-10-01)

Only content/localized labels and continuation destinations are in scope. Keep existing layout, styling, animations and appearance; another chat owns docs UI.
2026-10-01 user-authorized refinement: render setupSentence as a prose continuation separate from topic prev/next; three local-setup tutorials are first and marked by brand-colored lucide Zap. Preserve the existing page shell and animation.
