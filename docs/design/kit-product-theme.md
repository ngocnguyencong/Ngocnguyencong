# Kit product theme (for product builders)

Marketing brand and kit product theme are **separate files**. Appearance axes (color / density / radius / font) are summarized in [ui-appearance.md](./ui-appearance.md). File inventory: [supastack-theme-ui-inventory.md](./supastack-theme-ui-inventory.md). In-app guide: `/docs/web/theming`.

## Two theme files

| Surface                                                                   | File                         | Class              | Who edits                        |
| ------------------------------------------------------------------------- | ---------------------------- | ------------------ | -------------------------------- |
| Homepage / blog / docs / pricing / legal                                  | `apps/web/app/theme.css`     | `.marketing-theme` | Supastack brand maintainers only |
| Dashboard, auth, settings, billing, chat, org, invite, appearance gallery | `apps/web/app/app-theme.css` | `.app-theme`       | **Your product**                 |

Change `DEFAULT_STYLE_ID` in `apps/web/src/theme/styles.ts` to select the default look in one line. Server rendering and startup apply all six style axes. Marketing inherits that style by default; `MARKETING_THEME_MODE` can explicitly lock black or pin a different pack. Saved visitor preferences take priority over code defaults.

**Do not** treat marketing `theme.css` as the product theme source. Editing it restyles the kit’s public brand, not your SaaS chrome.

### Hybrid surfaces

Some routes use **both** classes (`marketing-theme app-theme`), e.g. `/auth` via `MarketingAccountShell`. The Obsidian lock requires `:not(.app-theme)`, so auth still follows the selected product pack while keeping marketing header/footer chrome.

## Customize your product (checklist)

0. Fastest path — set `DEFAULT_STYLE_ID` in `apps/web/src/theme/styles.ts` to a real `STYLE_CATALOG` ID (one bundle sets all six axes), or preview styles in Settings → Appearance → _Design style_. Compose pages from the copyable blocks in `apps/web/src/kit/blocks/` (`/kit-blocks` browses them in dev).
1. Edit structural tokens and component chrome in `apps/web/app/app-theme.css` (file header lists the steps).
2. Add or tune color packs in `apps/web/src/theme/catalog.ts` (ThemePicker lists every pack automatically).
3. Extend density / radius / font / layout catalogs in `apps/web/src/theme/presets.ts` **and** matching `html[data-*]` rules in `app-theme.css`.
4. Pick a marketing identity in `apps/web/src/theme/marketing-theme.ts` (`MARKETING_THEME_MODE`).
5. Keep consumers on semantic tokens: `var(--page|--raised|--text|--muted|--accent|…)`.
6. Leave `apps/web/app/theme.css` alone unless you are intentionally changing Supastack marketing brand.

Runtime pick without code: **Settings → Appearance** (ThemePicker + kit UI gallery; browser-local cookie + `localStorage`; not an account field). FOUC boot in `theme-boot.ts` restores all axes before paint. Gallery details: [kit-ui-gallery.md](./kit-ui-gallery.md).

---

## Example 1 — Soften kit chrome in `app-theme.css`

Change spacing/radius defaults on `.app-theme` only. Packs still supply colors.

```css
/* apps/web/app/app-theme.css */
.app-theme {
  --gutter: 24px;
  --radius-surface: 18px;
  --radius-card: 14px;
  --radius-control: 10px;
  --control-min-height: 44px;
  --button-min-height: 40px;
  --shadow-panel: 0 12px 40px color-mix(in srgb, var(--text) 8%, transparent);
}
```

Wire new UI with the same tokens:

```css
.app-theme .my-panel {
  background: var(--raised);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
}

.app-theme .my-panel .cta {
  background: var(--accent);
  color: var(--accent-ink);
  min-height: var(--button-min-height);
  border-radius: var(--radius-control);
}
```

Avoid hardcoding Obsidian hex (`#000`, `#efb779`) into product chrome — packs like Paper / Glacier will look broken.

---

## Example 2 — Add a color pack in `catalog.ts`

Append a full `ThemeDefinition` with **every** `THEME_TOKEN_NAMES` entry. ThemePicker and `themeStylesheet()` pick it up without extra wiring.

```ts
// apps/web/src/theme/catalog.ts — append inside THEME_CATALOG
{
  id: "coral",
  name: "Coral",
  description: "Warm light canvas with coral actions.",
  colorScheme: "light",
  tokens: {
    "--page": "#fff7f4",
    "--section": "#f8ebe6",
    "--raised": "#ffffff",
    "--text": "#1a1210",
    "--muted": "#5c4a44",
    "--border": "rgba(26, 18, 16, 0.12)",
    "--border-strong": "rgba(26, 18, 16, 0.26)",
    "--btn": "#1a1210",
    "--btn-text": "#fff7f4",
    "--accent": "#e06b4f",
    "--content-text": "#5c4a44",
    "--accent-hover": "#eb7f66",
    "--accent-ink": "#fff7f4",
  },
},
```

Required token names:

`--page`, `--section`, `--raised`, `--text`, `--muted`, `--border`, `--border-strong`, `--btn`, `--btn-text`, `--accent`, `--content-text`, `--accent-hover`, `--accent-ink`.

Then:

1. Extend contrast expectations in `apps/web/src/theme/contrast.test.ts` for the new pack.
2. Open `/settings` → General → select **Coral**.
3. Confirm `/dashboard`, `/auth`, `/billing`, `/chat` and homepage `/` update. An explicit `MARKETING_THEME_MODE="locked"` keeps marketing black; the default `"inherit"` follows the style.

---

## Example 3 — Add a density / radius / font preset

**A. Catalog** (`apps/web/src/theme/presets.ts`):

```ts
// e.g. extend DENSITY_CATALOG
{
  id: "dense",
  name: "Dense",
  description: "Minimal gutters for data-heavy admin layouts.",
},
```

**B. CSS remap** (`apps/web/app/app-theme.css`):

```css
html[data-density="dense"] .app-theme {
  --gutter: 12px;
  --space-section: 36px;
  --space-room: 16px;
  --stack-gap: 16px;
  --control-min-height: 36px;
  --button-min-height: 36px;
  --header-h: 52px;
}
```

**C. ThemePicker** already iterates the catalogs — new ids appear once catalogs + CSS exist. Keep `apply*` / boot fragment in sync if you change storage keys or defaults.

Orthogonal mix example: Paper + compact + sharp + geometric.

---

## Example 4 — Pick or add an app layout (`data-layout`)

The workspace shell ships three layouts: `sidebar` (default rail), `topnav` (horizontal top bar), `focused` (brand-only bar + centered column). Visitors preview them in Settings → Appearance; products set the feel by forking the CSS, not the markup — variants restyle `.app-frame` / `.workspace-rail` only.

To add a shell (e.g. icon rail):

```ts
// apps/web/src/theme/presets.ts — append inside LAYOUT_CATALOG
{
  id: "iconrail",
  name: "Icon rail",
  description: "Narrow icon-only rail for power users.",
},
```

```css
/* apps/web/app/app-theme.css */
html[data-layout="iconrail"] .app-theme .app-frame {
  grid-template-columns: 4.5rem minmax(0, 1fr);
}
html[data-layout="iconrail"] .app-theme .workspace-rail {
  padding: 24px 12px;
  align-items: center;
}
```

## Example 5 — Give your marketing site a different identity

`MARKETING_THEME_MODE` in `apps/web/src/theme/marketing-theme.ts`:

- `"locked"` — explicit override; marketing keeps black regardless of the app pick.
- `"inherit"` — default; marketing follows the configured style and visitor's color pack, density, radius, and font choices (ThemePicker repaints `/` too). The layout axis still controls app chrome.
- `"paper"` (any catalog id) — marketing pins that pack on its own wrapper, independent of the app shell.

The mechanism: packs also serialize `[data-theme="<id>"]:not(html)` selectors, so a `.marketing-theme` wrapper carrying `data-theme` repaints only its subtree.

---

## Example 6 — Add a testimonial section

`TestimonialGrid` is a complete copyable section: copy `apps/web/src/kit/blocks/marketing/testimonial-grid.tsx` and its `.module.css`, then supply your own heading and approved quotes. The dev-only `/kit-blocks` page previews four cards with fictional content; the default public landing has no testimonials. Marketing inherits the selected style by default, so these blocks follow its palette, density, radius, and font.

```tsx
<TestimonialGrid
  id="testimonials"
  eyebrow="Customer stories"
  heading="What customers say"
  intro="Feedback from people using the product."
  items={[
    {
      name: "Customer name",
      quote: "A quote they approved for publication.",
      rating: 4,
      lang: "en",
      avatar: <img src="/customers/customer.png" alt="" />,
    },
  ]}
  ratingLabel="{rating} out of 5 stars"
/>
```

`rating` fills that many of the five visible stars; omit it when no score was submitted. The optional `avatar` slot accepts an image, and `profileUrl` links the displayed name. Translate the section strings and `ratingLabel` in your product's locales while keeping a customer's original quote wording and `lang` when appropriate.

---

## What not to touch

| Do                                                   | Don't                                                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Edit `app-theme.css` for product look                | Edit marketing `theme.css` for product look                                                                   |
| Add packs in `catalog.ts`                            | Invent a second product theme stylesheet                                                                      |
| Use semantic `var(--*)` tokens in app UI             | Hardcode dark-only hex on chat/settings/billing/org                                                           |
| Rely on Settings ThemePicker + FOUC boot             | Persist theme as a Better Auth account field                                                                  |
| Keep marketing Feature Explorer / globe art as brand | Expect ThemePicker to restyle locked `.marketing-theme` pages (set `MARKETING_THEME_MODE="inherit"` for that) |

---

## Verification

- Unit: `catalog` / `presets` / `contrast` / `theme-ownership` / `theme-boot` contracts under `apps/web/src/theme/`.
- Browser: verify a one-line `DEFAULT_STYLE_ID` change on app shells and inherited marketing, including a fresh context and no-JavaScript rendering.
- Manual: ThemePicker → switch pack + density + radius + font + layout; check 320px, keyboard focus, and `prefers-reduced-motion`.

## Related

- Axes table: [ui-appearance.md](./ui-appearance.md)
- Inventory: [supastack-theme-ui-inventory.md](./supastack-theme-ui-inventory.md)
- In-app docs: `/docs/web/theming` (`apps/web/src/resources/additional-guides.ts`)
- Settings UI: `apps/web/src/theme/theme-picker.tsx`
