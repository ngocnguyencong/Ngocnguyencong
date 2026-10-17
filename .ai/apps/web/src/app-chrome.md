# apps/web/src/app-chrome.tsx

## Purpose

WorkspaceShell composes banners, localized workspace navigation, user menu and content. AppBrand renders a text-only default name; an explicit custom workspace/domain logo remains supported. Navigation glyphs come from Lucide. ShellNavigation owns the shared frame: its server-rendered rail remains expanded until client enhancement, then it moves the same sidebar tree into a modal drawer at narrow widths and for the focused layout. The collapsible layout keeps the workspace switcher, account control, nav entries, and footer links in the icon rail with accessible labels and visible hints. Keep WorkspaceNavItem and navigation entries aligned, locale-qualified routes, aria-current, and user-menu placement in the rail. The "AI task" item targets `/ai` (localized to `/{locale}/ai` via `localePath`); "Dashboard" targets the analytics `/dashboard` — the two are distinct products.

## Change History

- 2026-10-15: `AppearanceSync` mounted inside `WorkspaceShell` — signed-in app chrome (and the desktop webview) syncs appearance via `/api/account/appearance`; marketing pages never call the API.
- 2026-10-13: "AI task" nav retargeted `/dashboard#production-task` → `/ai`.
- 2026-10-04: default logo artwork removed; demo content stays neutral.
- 2026-10-06: ShellNavigation now owns responsive desktop/mobile framing; app chrome localizes its navigation labels and uses Lucide glyphs.
