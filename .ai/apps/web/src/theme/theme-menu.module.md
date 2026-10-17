# src/theme/theme-menu.module.css

Same popover grammar as `language-switcher.module.css`: 42px ghost trigger
(border → `--border-strong` on hover/open), blurred `--section` popover,
`data-side="top"` flips to open upward (footer use), `data-align` controls
horizontal anchor, and `data-closing` drives the 130ms exit. Options are
full-width buttons with a `.swatch` (page disc + accent dot, caller colors
via inline style), name, and trailing check on `aria-pressed="true"`.
Popover scrolls past 70vh/420px for long catalogs. All open/close motion is
`no-preference` gated.
