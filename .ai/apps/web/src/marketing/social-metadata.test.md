# src/marketing/social-metadata.test.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose（一句话人话）

钉死 og/twitter 契约：页面级 social 元数据必须经 `pageSocialMetadata()` 组合。

## Important Notes / NEVER Change

- 为什么：Next 按顶层 key 合并 metadata——页面写自己的 `openGraph`/`twitter`
  对象会**整体替换** layout 的（丢 siteName/type/locale/images，card 回退
  "summary"）。有线上站点 2026-09-24 实锤：首页 og:image/og:site_name
  全部消失。
- 测试三段：(a) `pageSocialMetadata` 输出形状（siteName/type/url/locale/
  publishedTime + twitter card，默认**不设 images**）；(b) `images` 同时传到
  OG/Twitter，`rootOgImage` 指向存在且尺寸匹配的 `public/demo-social.png`，首页和
  layout 显式引用它，文章仍有独立生成卡片；(c) 递归扫 `app/**/{page,layout}.tsx`，
  除 `app/layout.tsx` 外禁止 `openGraph: {`/`twitter: {` 字面量。
- 注意误报面：注释里写 `openGraph: {` 也会命中（故意的——别在注释里写）。

## Open Threads / Resume Context

None.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-27 | Pinned static asset bytes/dimensions, explicit homepage/layout references, and generated article exception | Codex |
| 2026-09-24 | +images 透传测试（[locale] 段无约定文件需显式 rootOgImage） | Devin |
| 2026-09-24 | 创建 — 页面级 og/twitter 整体替换契约测试 | Devin |
