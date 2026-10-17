# apps/web/app/sitemap.ts

> Last updated: 2026-09-24 | Protection: STANDARD

## Purpose(一句话人话)

sitemap.xml 生成:`buildMarketingSitemapEntries()` 的每条 path 拼上
`siteOrigin()` 输出绝对 URL。

## Important Notes / NEVER Change

- `force-dynamic` 不可删:构建期 `APP_URL` 为空 → `siteOrigin()` 回退
  `http://localhost:3000`,静态 sitemap.xml 会把 localhost 烘给所有爬虫
  (2026-09-24 修复,与 robots.ts / 营销页同批)。钉死测试:
  `src/marketing/public-routes-dynamic.test.ts`。
- 增删公共路由时同步 `marketingStaticPaths` + `STATIC_ENTRY_META`
  (`src/marketing/marketing-sitemap.ts`)。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-24 | `force-dynamic` — 绝对 URL 在请求时解析 APP_URL | Devin |
