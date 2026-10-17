# apps/web/app/blog/[slug]/page.tsx

> Last updated: 2026-09-24 | Protection: STANDARD

## Purpose（一句话人话）

`/blog/{slug}` 文章页——canonical + 文章 OG/Twitter 元数据 + `BlogArticle`。

## Important Notes / NEVER Change

- `force-dynamic` 不可删（构建期 `APP_URL` 为空会把 localhost 烘进
  canonical/og:image——见 `public-routes-dynamic.test.ts`）。
- social 元数据必须走 `pageSocialMetadata()`（siteName =
  `getRequestBrand().name`）：页面手写 `openGraph`/`twitter` 对象会整体
  替换 layout 的字段（丢 siteName/type/locale）。`type:"article"` +
  `publishedTime` 经 helper 的 article 分支输出。
- 图片不设：本段有自己的 `opengraph-image.tsx` 文件约定，按段注入每篇
  文章的专属卡片；twitter.images 在 resolve 时自动继承 og.images。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-24 | `force-dynamic` + og/twitter 改走 `pageSocialMetadata()` | Devin |
