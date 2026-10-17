# UI appearance choices

How a product built on Supastack picks a look without forking a parallel CSS system.

## Axes

| Axis          | Where                                                  | Default         | Notes                                                                                                                 |
| ------------- | ------------------------------------------------------ | --------------- | --------------------------------------------------------------------------------------------------------------------- |
| Color pack    | `apps/web/src/theme/catalog.ts` + Settings ThemePicker | **Obsidian**    | Paints `html[data-theme]` color tokens (`--page`, `--text`, `--accent`, …). Contrast contracts in `contrast.test.ts`. |
| Density       | `apps/web/src/theme/presets.ts` + `html[data-density]` | **comfortable** | Compacts gutters, section space, control/button min-heights on `.app-theme`.                                          |
| Corner radius | same presets + `html[data-radius]`                     | **soft**        | Remaps `--radius-surface`, `--radius-card`, `--radius-control` (`sharp` / `round`).                                   |
| Font pairing  | same presets + `html[data-font]`                       | **editorial**   | Remaps `--font-sans` / `--font-serif` (`geometric` / `monospace`).                                                    |
| App layout    | same presets + `html[data-layout]`                     | **sidebar**     | Shared responsive shell (`topnav` / `focused` / `collapsible`), including compact drawers.                            |

Axes are orthogonal: e.g. Paper + compact + sharp + geometric + topnav.

**Design styles** (`apps/web/src/theme/styles.ts`) bundle color, density, radius, font, layout, and toast style into named whole-look picks. Change `DEFAULT_STYLE_ID` in that file to set the product default in one line; server rendering and startup apply the entire bundle. ThemePicker applies visitor choices via `applyStyle`; mixing axes afterwards becomes a custom blend.

## Surfaces

- **Product / app chrome** (dashboard, auth, settings, billing, chat): `.app-theme` in `apps/web/app/app-theme.css` consumes the tokens above.
- **Appearance playground**: `/settings/appearance` mounts ThemePicker + `KitUiGallery` so builders preview buttons, inputs, cards, badges, and dialogs under the active pack/presets. See [kit-ui-gallery.md](./kit-ui-gallery.md).
- **Block library**: `apps/web/src/kit/blocks/` (registry `src/kit/blocks.ts`) — copyable token-only sections; browse live on the dev-only `/kit-blocks` route.
- **Marketing homepage**: inherits the configured style and saved visitor choices by default. `MARKETING_THEME_MODE` in `apps/web/src/theme/marketing-theme.ts` can explicitly lock black or pin a different pack.

## How a product customizes

1. **Settings → Appearance** — ThemePicker (browser-local cookie + `localStorage`, not an account field) plus the live kit UI gallery. FOUC boot in `theme-boot.ts` restores all axes before paint.
2. **Add a color pack** — append a `ThemeDefinition` in `catalog.ts` with every `THEME_TOKEN_NAMES` entry; keep light/dark contrast contracts.
3. **Deeper chrome** — edit structural rules and component selectors in `app-theme.css` only; keep using `var(--radius-*)`, `var(--control-min-height)`, etc.
4. **Do not** invent a second theme stylesheet, edit marketing `theme.css` for product look, or hardcode Obsidian hex into app chrome.

Worked examples (new pack, chrome tokens, preset axis): [kit-product-theme.md](./kit-product-theme.md). In-app guide: `/docs/web/theming`.

## Related

- File ownership + examples: [kit-product-theme.md](./kit-product-theme.md)
- Gallery playground: [kit-ui-gallery.md](./kit-ui-gallery.md)
- Inventory: [supastack-theme-ui-inventory.md](./supastack-theme-ui-inventory.md)
- Settings UI: `apps/web/src/theme/theme-picker.tsx`, `apps/web/src/theme/kit-ui-gallery.tsx`

## Shared UI foundation

- Structural defaults live in `apps/web/app/foundation.css` at the document root, including body-level overlays. The radius/density/font axes apply before paint; surface themes retain purposeful differences.
- `@supastack/design-tokens` exports shared `motionTokens`, `semanticStatusColors`, and `mobilePalettes` alongside the compatible reference tokens. Native palettes adapt these roles without adopting web navigation.
- Themes define success, warning, danger, and information colors, solid foregrounds, soft backgrounds, focus rings, and control borders. Use status colors on soft backgrounds; the foreground tokens belong on solid status fills.
- Use `--accent-text` for colored labels and links; keep `--accent` for action fills and indicators. Colored text is adjusted only when needed to pass on plain and tinted surfaces. Copyable blocks can use `var(--accent-text, var(--accent))` for compatibility.
- Shared controls in `apps/web/src/ui/primitives.tsx` provide Select, Popover, Dialog, Sheet, Tabs, and Disclosure. Select accepts native form props and option children; keep an explicit visible label. Dialogs and sheets contain focus and restore the opener. Essential disclosure content stays available without JavaScript.
- `toast.info/success/error(message, { durationMs?, persistent? })` supports timed or persistent feedback. Errors persist by default and are never evicted for routine success messages. Root geometry also paints toast corners.

## Layouts and blocks

Sidebar, top navigation, focused, and collapsible layouts share `ShellNavigation`. Phones use a compact header and a modal navigation drawer; focused desktop uses the same access pattern. Without JavaScript, the full rail remains navigable. Collapsed sidebar state is a separate browser-local preference.

Master/detail, table toolbar, and pagination are controlled copyable app blocks. Consuming pages own data fetching, URL state, selection, filtering, pagination, and workspace authority. Both preview surfaces show working examples and loading, empty, error, disabled, and overlay states.

## Additional light palettes

Ocean uses cool teal; Lavender uses soft violet; Cobalt uses clear blue; Sand uses warm beige and brown. Their curated style bundles demonstrate comfortable/compact spacing, the collapsible sidebar, and top navigation. `obsidian-studio` remains the default.

## Motion and accessibility

Shared timings are 120ms feedback, 180ms entrance, 120ms exit, 220ms disclosure opening, and 160ms closing. Repeated interactions remain interruptible; reduced motion removes spatial movement while keeping labels and state cues. Contrast contracts measure text at 4.5:1 and required control indicators at 3:1 instead of relying on luminance ordering.
