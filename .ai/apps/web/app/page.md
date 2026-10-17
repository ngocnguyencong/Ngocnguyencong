# app/page.tsx

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose（一句话人话）

根路由 `/` —— 默认渲染 `LandingPage`（force-dynamic）；`?taskId`/
`?submissionKey` 时经 `src/ai-task-recovery.ts` 的 `taskRecoveryHref`
302 到 `/ai`（AI task console；历史分享链接兼容，参数透传）。

## What It Does

- 透传 `?waitlist`/`?position`/`?code` 给 `LandingPage.waitlist`（数组值取
  首个字符串）。
- `generateMetadata`：`title.absolute`（标题已含品牌，避免 template 二次
  追加）+ canonical `/` + `homeLanguageAlternates()` +
  `pageSocialMetadata({siteName: brand.name, url: "/", images: [rootOgImage]})`
  （og:url/og:title/siteName/静态卡片；页面级对象会替换 layout 的图像字段）。

## Important Notes

- Homepage metadata uses the English `marketingLanding` copy with the resolved
  request brand. Preserve canonical, hreflang, social images, and recovery links.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-13 | Waitlist params read via shared `firstSearchParam` | Devin |
| 2026-10-13 | Recovery forward extracted to shared `taskRecoveryHref` (`src/ai-task-recovery.ts`) | Devin |
| 2026-10-13 | `?taskId`/`?submissionKey` recovery now redirects to `/ai` instead of mounting the dashboard view | Devin |
| 2026-09-27 | Homepage explicitly passes shared `/demo-social.png` to social metadata | Codex |
| 2026-09-24 | static metadata → `generateMetadata`：title.absolute + pageSocialMetadata（修 og:title 被 template 二次追加 + 补 og:url/siteName） | Devin |
| 2026-09-22 | waitlist searchParams → LandingPage | Devin |
