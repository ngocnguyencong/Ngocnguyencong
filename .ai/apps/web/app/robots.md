# app/robots.ts

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose（一句话人话）

robots.txt 生成：认证/app 路由一律 disallow，营销路由开放。

## Important Notes / NEVER Change

- `APP_ROUTE_PREFIXES` 收全部 app 前缀；`LOCALIZED_APP_PREFIXES` 是
  `/*/`-locale 镜像——两者都要加新 app 路由（AGENTS.md SEO 契约）。
- `/feedback` 是 app 路由（workspace 数据），必须 disallow，不进 sitemap。
- `force-dynamic` 不可删：sitemap URL 是绝对的，静态构建会把
  `localhost:3000`（或 `build.invalid`）烘进 robots.txt——2026-09-24 已修。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | +`/setup` disallow — in-app readiness checklist is dev-open/admin-only and stays unindexed | Devin |
| 2026-10-10 | +`/landing-v2` disallow — dev-gated preview route like `/kit-blocks` | Devin |
| 2026-09-24 | `force-dynamic` — sitemap URL 在请求时解析 APP_URL | Devin |
| 2026-09-22 | +`/feedback` + `/*/feedback` disallow | Devin |
