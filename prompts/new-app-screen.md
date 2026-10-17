# Prompt: new app screen

Add a screen to the workspace app at `<route>` for **`<what it does>`**.

Use the app shell and token system — the screen must work under every
`data-layout` variant (sidebar, topnav, focused) and every theme pack:

1. Render inside `WorkspaceShell` (`apps/web/src/app-chrome.tsx`) with the
   correct `active` nav item; add a nav item only if the product genuinely
   has a new top-level section.
2. Compose content from app blocks in `apps/web/src/kit/blocks/app/`
   (`stat-grid`, `empty-state`) and the kit UI patterns in
   `apps/web/src/theme/kit-ui-gallery.tsx` (buttons, inputs, cards, badges,
   dialogs) before writing new chrome.
3. Tokens only: `var(--page|--section|--raised|--text|--muted|--border|
--accent|--radius-*|--font-*|--control-min-height|--space-*)`. No hex.
4. Scope any user-owned data by `workspaceId`; keep provider secrets
   server-only and out of logs.
5. Test-first for behavior; follow existing `*.test.ts` conventions in
   `apps/web/src/`.
6. Verify: `pnpm check` green, and eyeball the screen under
   `data-layout=topnav` and `data-layout=focused` (Settings → Appearance →
   App layout) plus at 390px — the layout axis must not break your content.

If the screen needs a shell the three layouts can't express, extend
`LAYOUT_CATALOG` + `html[data-layout]` rules in `app-theme.css` instead of
forking `WorkspaceShell`.
