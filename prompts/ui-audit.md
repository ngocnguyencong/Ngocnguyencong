# Prompt: UI audit

Audit `<route or component>` for visual quality, accessibility, and
theme-system fit. Report findings ordered by severity, then fix what I
approve — or fix all of it if I say so.

Use the installed design skills per AGENTS.md (`impeccable`,
`better-interface`, `web-design-guidelines`; `better-*` subskills by domain)
and check concretely:

- **Tokens** — any hardcoded color/spacing that should be a `var(--*)` token;
  anything that breaks under a different pack or `data-layout`.
- **Accessibility** — contrast (light + dark packs), visible focus, labels,
  hit targets ≥44px, reduced-motion, keyboard path through interactive
  elements, 320px wrap.
- **Layout** — alignment, spacing rhythm, reading order, truncation, widows;
  check at 1440px and 390px in the browser.
- **Icons** — `lucide-react` present where icons belong, `aria-hidden` on
  decorative ones, `currentColor` so they follow the pack.
- **Chrome fit** — does it use the app shell / marketing surface correctly,
  or fight them with one-off CSS?

Verify in the browser on the dev server; don't audit from code alone.
