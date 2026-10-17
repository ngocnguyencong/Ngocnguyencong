# app/[locale]/page.tsx

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose（一句话人话）

本地化 landing（`/de` `/es` `/fr`）—— `/en` 307 回 `/`；非法 locale
notFound；渲染 `LandingPage locale`。

## What It Does

- `generateMetadata` 产出 locale canonical + hreflang；social 元数据走
  `pageSocialMetadata()`（siteName = `getRequestBrand().name`，传
  `images: [rootOgImage]`——`[locale]` 段没有自己的 opengraph-image
  约定文件，不显式传图 og:image 会整体丢失，已实测验证）。不可再手写
  `openGraph`/`twitter` 对象，会整体替换 layout 的字段（丢 siteName/type/
  locale，2026-09-24 修复）。
- 透传 waitlist searchParams（status/position/code）给 LandingPage，
  与 `/` 行为一致。

## Important Notes

- The request locale selects neutral `marketingLanding` metadata; the title uses
  the resolved request brand. Keep canonical/hreflang/social image behavior and
  locale validation intact.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-13 | `en` redirect preserves recovery params (`/en?taskId` → `/ai?taskId`); non-en locales forward them to `/{locale}/ai`; waitlist params via shared `firstSearchParam` | Devin |
| 2026-09-27 | Kept explicit localized image reference while shared descriptor moved to `/demo-social.png` | Codex |
| 2026-09-24 | openGraph 手写对象 → `pageSocialMetadata()`(修复 siteName/type 被整体替换丢失) | Devin |
| 2026-09-22 | +searchParams → waitlist 状态透传 | Devin |
