# src/kit/blocks/chrome/site-footer.module.css

Token-only footer grid: `.inner` is brand column + auto-fit link groups
(max `--max`, gutter padding); `.controls` is a full-width flex-end row
above `.legal` with a top hairline; `.legal` keeps its own hairline only
when `.controls` is absent (`.controls + .legal` resets margin/border to
avoid a double rule). Mobile collapses groups to two columns with the brand
column spanning the row.
