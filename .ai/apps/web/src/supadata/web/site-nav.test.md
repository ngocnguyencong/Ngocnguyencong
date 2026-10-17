# apps/web/src/supadata/web/site-nav.test.tsx

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Render tests (`renderToStaticMarkup`) for `SiteNav`: period controls are
`<a href>` links preserving `site`/query params with `aria-current="page"`
on the active period (including `12M`), and the site picker is a real
`<select name="site">` inside a GET form with a `<noscript>` submit button
(no-JS navigation). Guards against regressing back to JS-only `router.push`
buttons or a native-only select.

## Important Notes / NEVER Change

- Assert attribute presence, not attribute order — React reorders props in
  serialized markup.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Added for WP4 dashboard polish | Devin |
