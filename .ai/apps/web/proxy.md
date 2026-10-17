# proxy.ts

> Last updated: 2026-09-22 | Protection: CRITICAL

## Purpose（一句话人话）

Next middleware/proxy：locale 解析（path > cookie > accept-language）、
`/en/*` 前缀 307 归一化、`x-supastack-locale` 请求头注入、`supastack_locale`
cookie 回写，以及 growth 参数（`?ref=`/`?invite=`）落 httpOnly cookie。

## What It Does

- 每请求产出 NextResponse（redirect 或 next+headers 注入）。
- `captureGrowthParams` — 两个响应分支都调用；`growthCookiesToSet` 负责
  净化（`growth/growth-cookies.ts`），httpOnly + lax + 30d/14d。
- matcher 排除静态资源与带 `.` 的路径。

## Important Notes / NEVER Change

- proxy 必须零 DB/零重依赖 —— 只 import `@supastack/i18n` 与纯函数模块；
  不能引 `growth-store`（server-only + drizzle）进 middleware bundle。
- `/en` redirect 分支也要种 growth cookie（参数靠 clone 的 query 存活）。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-22 | +`captureGrowthParams`：ref/invite 落 httpOnly cookie | Devin |
