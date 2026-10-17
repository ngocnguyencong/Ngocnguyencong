# apps/web/src/marketing/api-reference.module.css

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

CSS module for `api-reference-page.tsx`: `.auth` explainer copy,
`.endpoints`/`.endpoint` card list, `.endpointHead` row (method badge +
mono path + right-aligned `.access` label), and `.method[data-method]`
token colors inside the utility-page `.prose` column.

## Important Notes

- Method → token map: get=`--info`, post=`--success`, put/patch=
  `--warning`, delete=`--danger` (each falling back to `--accent`);
  `color-mix` softens the border tint.
- `.endpointHead` flex-wraps + `.path` uses `overflow-wrap: anywhere` —
  stays inside 320px.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-10 | Created for the public `/api-reference` route | Devin |
