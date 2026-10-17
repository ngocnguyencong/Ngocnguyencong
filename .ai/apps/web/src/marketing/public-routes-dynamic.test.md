# src/marketing/public-routes-dynamic.test.ts

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose(一句话人话)

钉死契约:每个公开可索引路由必须 `export const dynamic = "force-dynamic"`。

## Important Notes / NEVER Change

- 为什么:静态预渲染在 `next build` 时求值 metadata,而构建期 `APP_URL`
  为空 → `siteOrigin()` 回退 `http://localhost:3000` → canonical /
  og:image / hreflang / robots.txt / sitemap.xml 全部烘成 localhost,
  爬虫永远解析不到(2026-09-24 实锤:pricing.html、blog 等 og:image
  全是 localhost)。
- 测试由 `marketingStaticPaths` 驱动——往 sitemap 加新公共路径会自动被
  钉住,不需要改测试。不遵循 `app<route>/page.tsx` 布局的放进
  `ROUTE_TO_FILE` 映射。
- 另钉参数化页(`/blog/[slug]`、`/docs/[[...slug]]`)和输出绝对 URL 的
  metadata/生成路由(`robots.ts`、`sitemap.ts`、`app/llms.txt/route.ts`)。
- `/pricing` 等纯 redirect stub 不在 sitemap、无需 dynamic。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-06 | Metadata-route list += `app/llms.txt/route.ts` (absolute links bake origin) | Devin |
| 2026-09-25 | `process.cwd()` → `APP_ROOT` (`import.meta.url`-anchored `../..`) — root-level `pnpm test` ran with repo cwd and every lookup ENOENT'd | Devin |
| 2026-09-24 | 创建 — localhost-baked-metadata 回归测试 | Devin |
