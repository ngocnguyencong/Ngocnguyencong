# Kit UI gallery / appearance playground

Builders need to **see** what kit tokens buy them — not only pick packs in isolation.

## Route

| Surface               | Path                   | Notes                                                                                    |
| --------------------- | ---------------------- | ---------------------------------------------------------------------------------------- |
| Appearance playground | `/settings/appearance` | Behind `.app-theme` via `WorkspaceShell`. No session required for ThemePicker + gallery. |

ThemePicker moved here from General. Profile / avatar stay on `/settings/general`.

## What it shows

`KitUiGallery` (`apps/web/src/theme/kit-ui-gallery.tsx`) previews kit-owned controls:

- Buttons — `button-primary` / `button-secondary` / disabled
- Inputs — text, select, textarea, checkbox
- Cards — raised `empty-card` panels
- Badges — `status-badge-signal` / `telemetry` / `neutral`
- Dialogs — native `<dialog>` with tokenized panel + backdrop

All demos consume existing `app-theme.css` selectors and CSS variables (`--page`, `--raised`, `--accent`, `--radius-*`, …). Changing ThemePicker color / density / radius / font axes live-updates the gallery because packs paint `html[data-*]`.

## Customization contract

1. Edit chrome in `apps/web/app/app-theme.css` (gallery layout under `.kit-ui-gallery*`).
2. Add packs / presets via `catalog.ts` / `presets.ts` — gallery follows automatically.
3. Do **not** restyle marketing homepage art or `.marketing-theme` brand lock for this playground.

## Related

- [ui-appearance.md](./ui-appearance.md) — axes + persistence
- [kit-product-theme.md](./kit-product-theme.md) — file ownership
- [supastack-theme-ui-inventory.md](./supastack-theme-ui-inventory.md) — surface map
