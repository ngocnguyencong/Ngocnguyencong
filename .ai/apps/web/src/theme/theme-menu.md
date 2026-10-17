# src/theme/theme-menu.tsx

## Purpose

Compact color-pack picker for site chrome — mounted in the marketing
`SiteFooter` controls row (and composable into the copyable chrome block's
`controls` slot). Mirrors `LanguageSwitcher`'s details/summary popover
contract: `side`/`align` props, outside-pointer close, Escape + refocus,
ArrowDown opens and focuses the current option, ArrowUp/Down cycle the list.

## Important Notes

- Applies picks via `runThemeTransition(() => setTheme(applyTheme(id)),
  origin)` — the view-transition circle reveal originates from the option's
  center; reduced motion / missing `startViewTransition` fall back to an
  instant switch. Persistence (localStorage + cookie + `data-theme`) is all
  inside `applyTheme`.
- A `MutationObserver` on `documentElement[data-theme]` keeps the trigger
  label in sync when another control (Settings → Appearance) changes the
  pack — the footer menu never goes stale.
- Options are `<button aria-pressed>` (not links — no navigation), each with
  a two-tone swatch (`--page` disc + `--accent` dot) and the pack name.
- `label` prop takes the localized appearance name (`appearance.theme` from
  `copyForLocale`) for the trigger's aria-label.
- User picks call `markAppearanceChanged()` (`theme/appearance.ts`) — stamps
  the local sync timestamp so `AppearanceSync` pushes the choice to the
  account API. The menu itself never calls the API; marketing stays offline.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-15 | Pack picks stamp the appearance-change marker for cross-device sync | Devin |
