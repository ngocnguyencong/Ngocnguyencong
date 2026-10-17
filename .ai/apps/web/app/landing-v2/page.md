# app/landing-v2/page.tsx

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

Dev-only alternate landing preview — a second composition of the kit's
existing blocks so the owner can compare arrangements before choosing.
404s in production exactly like `/kit-blocks`
(`process.env.NODE_ENV !== "development" → notFound()`); also disallowed in
`app/robots.ts` and kept out of the sitemap.

## What It Does

- Different arrangement than the default landing (`src/landing-page.tsx`):
  `HeroSplit` instead of `HeroCentered`, `FeatureTabs` + `FeatureRows`
  instead of `FeatureGrid`, no waitlist band and no scroll-end dialog.
  PricingCards, FaqAccordion, CtaBand, SiteHeader, SiteFooter, HomeShell,
  ScrollReveal, and the `styles.anchor` scroll-margin module are shared.
- Feature-tabs items describe real kit capabilities factually: sign-in +
  workspaces, billing + entitlements, AI module, jobs + email, and theme
  packs/presets/blocks. Copy stays neutral — no testimonials, trust counts,
  or sales claims; pricing repeats the "illustrative" disclaimer.
- Hero copy reuses `marketingLanding` dictionary strings (`metadataTitle` as
  the kicker, `title`/`description`/`primaryAction` unchanged); FAQ reuses
  `siteConfig.faq`. Media slots use `ProductFrame` + a small inline
  `ModuleVignette` (token-tinted rows, same neutral style as the kit-blocks
  minimal showcase).
- No locale mirror — dev-gated routes follow `/kit-blocks`, which has no
  `app/[locale]/` equivalent. `metadata` sets `robots: noindex` + a
  preview title only.

## Open Threads / Resume Context

None.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-10 | Initial route — alternate composition previewing feature-tabs | Devin |
