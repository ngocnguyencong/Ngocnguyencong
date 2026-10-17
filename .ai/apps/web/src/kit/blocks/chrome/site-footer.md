# src/kit/blocks/chrome/site-footer.tsx

## Purpose

Copyable public-site footer block: `brand` mark + `tagline`, `groups` link
columns (each a labelled `<nav>` + `<ul>`), optional `controls` row for
visitor pickers (language/theme menus render above the legal line), and
optional `legal` bottom line. Caller supplies everything — no built-in
destinations.

## Important Notes

- `controls` renders in a full-width end-aligned row separated by a
  hairline; `.controls + .legal` drops the legal row's own top border so the
  pair stays a single separator.
- Demo in `app/kit-blocks/page.tsx` passes the real `ThemeMenu` +
  `LanguageSwitcher` into `controls` — the intended composition.
- Every public page needs privacy/terms reachable from this block; keep
  `groups`/`legal` honest — no dead links.
