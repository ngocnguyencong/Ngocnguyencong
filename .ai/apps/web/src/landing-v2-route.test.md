# apps/web/src/landing-v2-route.test.ts

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

Source-level guard for `app/landing-v2/page.tsx` (mirrors the
`mail-preview-route.test.ts` convention — reads the route file rather than
rendering it, so no server-config mocks are needed).

## Coverage

- Dev gate: `process.env.NODE_ENV !== "development"` + `notFound` (the same
  guard `/kit-blocks` uses).
- Composition is deliberately different from the default landing:
  `HeroSplit` + `FeatureTabs` present, `HeroCentered`/`WaitlistBand` absent.
- Neutral-content boundary: no testimonial references; the "Illustrative
  prices" disclaimer is kept.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-10 | Initial test | Devin |
