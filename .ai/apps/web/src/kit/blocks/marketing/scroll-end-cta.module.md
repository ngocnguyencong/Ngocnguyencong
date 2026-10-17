# src/kit/blocks/marketing/scroll-end-cta.module.css

Token-only dialog styles: `.dialog` is a transparent `margin: auto` top-layer
box (`width: min(540px, 100vw - 32px)`); `.panel` carries the surface —
`--raised` background, `--border-strong` hairline, `--radius-card`, ambient
`--page` shadow — so it remaps with every pack/preset. `::backdrop` is a
`--page` color-mix dim. Actions are `.primary` (accent fill /
`--accent-ink`) and `.secondary` (`--section` + border). Entrance (`240ms`
rise+scale), exit (`160ms`), and backdrop fades all live under
`prefers-reduced-motion: no-preference`. `.preview` caps the inline gallery
render at the dialog width.
