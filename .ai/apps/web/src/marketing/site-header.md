# src/marketing/site-header.tsx

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose（一句话人话）

marketing header——现在是 async server wrapper：每次请求解析
`getViewerSnapshot()` 并渲染 `SiteHeaderClient`（`site-header-client.tsx`）。
交互本体已移入 client 组件。

## What It Does

- `navLabels` 把 config 的英文 label 映射到 `copy.nav.*`（Waitlist →
  `nav.waitlist`）。
- `hrefFor`：非首页 active 时把 `#anchor` 变 `/#anchor`；绝对 `/` 路径原样。
- 移动菜单用 `<dialog>` + WAAPI 动画，reduced-motion 立即完成；noscript
  有兜底 nav。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-27 | `aria-current` 改用 `isActiveSection`（desktop/mobile/noscript 三处） | Devin |
| 2026-09-22 | navLabels +Waitlist（`nav.waitlist`） | Devin |

## 2026-10-16 server-seeded viewer snapshot (anti-flicker)

`SiteHeader` is an async server component again: it awaits
`getViewerSnapshot()` (`viewer-snapshot.ts` — `server-only`, React `cache`,
`getAuthSession(await headers())`, any throw → `undefined`) and renders
`<SiteHeaderClient active locale viewer>`. Marketing nav links are plain
`<a>` full document loads, which emptied the browser-only session cache on
every click; SSR + first client render previously had `session ===
undefined`, so the account action was absent and popped in after hydration.
The snapshot makes SSR markup carry the right button immediately; the live
`useCachedSession` result still wins once it resolves. Both `noscript`
blocks use the snapshot when known (signed-in → `/dashboard` +
`auth.returnToDashboard`). `undefined` = unknown → old pending markup.

**Boundary note:** `MarketingAccountShell` renders inside `"use client"`
auth pages (`web-auth-page.tsx`, `authjs-signin.tsx`), where an async server
component cannot mount — it therefore renders `SiteHeaderClient` directly
(no snapshot; today's session-resolution behavior is preserved there).

## 2026-10-13 account-state stability
Enhanced navbar actions wait for a confirmed session. A single browser client and document-scoped confirmed snapshot survive header remounts and pending/error refetches. Confirmed sign-out and account changes immediately replace the displayed identity. No persistent user data or server-wide session cache is added. No-JS actions remain real navigation/forms in noscript, including desktop.
The generic demo header uses its existing Get started action for guests and localized Return to dashboard for authenticated users. No purchase/license machinery is included. Session and header regressions pass with the existing public-page suite. Existing typography, menu focus, motion and locale dictionaries are preserved.
