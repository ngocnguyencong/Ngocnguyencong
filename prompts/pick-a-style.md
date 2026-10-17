# Prompt: apply a design style

Apply the **`<style-id>`** design style across this product.

The style is one of `STYLE_CATALOG` in `apps/web/src/theme/styles.ts`. It sets
six axes at once: color pack, density, corner radius, font pairing, app
layout, and toast style. For a restrained light marketing look,
`minimal-product` (on the `minimal` pack) pairs with the minimal marketing
blocks (`hero-product`, `steps-ruled`, `feature-story`, `comparison-ruled`,
`pricing-panel`, `faq-split`, `cta-form`). Do this:

1. Read `apps/web/src/theme/styles.ts` and find the `<style-id>` entry (or tell
   me it doesn't exist and list the real ids).
2. Make it the product default: change the one line `DEFAULT_STYLE_ID` in
   `apps/web/src/theme/styles.ts` to `<style-id>`. Server rendering and startup
   apply all six axes. Existing explicit visitor preferences still win; verify
   defaults in a fresh browser context.
3. Set the marketing identity deliberately in
   `apps/web/src/theme/marketing-theme.ts` (`MARKETING_THEME_MODE`): the default
   `"inherit"` follows the whole style. Use `"locked"` or a pinned pack only
   when this product deliberately needs an independent marketing palette.
4. Preview on the dev server: Settings → Appearance → Design style → pick
   `<style-id>`; check `/dashboard`, `/auth`, `/settings`, and `/` on desktop
   and ~390px.
5. Keep `pnpm check` green — especially theme contract tests, and update any
   contract that asserts the old defaults **deliberately**, not silently.

Do not hardcode colors, do not fork `app-theme.css`/`theme.css`, and do not
persist the style as an account field — axes stay browser-local.
