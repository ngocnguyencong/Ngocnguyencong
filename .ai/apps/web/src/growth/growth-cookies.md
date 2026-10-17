# src/growth/growth-cookies.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

`?ref=` / `?invite=` 首次触达捕获 —— proxy.ts 把这两个参数写成 httpOnly
cookie（`supastack_ref` 30 天 / `supastack_invite` 14 天），waitlist join
action 与 auth user-create hook 再读回。

## What It Does

- `growthCookiesToSet(searchParams)` → 待写 cookie 列表（纯函数；写时净化）。
- `readGrowthCookies(jar)` → `{ ref, invite }`（读时再次净化——被篡改的
  cookie 降级为"无码"，永远不会变成查询参数）。
- `CookieReader` 结构类型同时兼容 `NextRequest.cookies` 与 `cookies()`。

## Important Notes

- 无 `server-only` / 无 next 依赖 —— proxy.ts（edge middleware）可用。
- Cookie 名是 web 层与 packages/auth 注入面的契约；改动要同步
  `auth-runtime.ts` 的 `earlyAccess.cookies`。
