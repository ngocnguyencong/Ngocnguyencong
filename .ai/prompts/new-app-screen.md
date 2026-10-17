# prompts/new-app-screen.md

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

Pasteable prompt that adds a screen at `<route>` inside the workspace app
shell for `<what it does>` — composing kit app blocks and tokens instead
of bespoke chrome.

## What It Does

- Requires `WorkspaceShell` (`apps/web/src/app-chrome.tsx`) with the
  correct `active` nav item; new top-level nav items only when the product
  genuinely gains a section.
- Composes content from `apps/web/src/kit/blocks/app/` (`stat-grid`,
  `empty-state`) and the `apps/web/src/theme/kit-ui-gallery.tsx` UI
  patterns (buttons, inputs, cards, badges, dialogs) before writing new
  chrome; tokens only (`var(--*)`), no hex.
- Repeats the standing rules: `workspaceId` scoping for user-owned data,
  server-only provider secrets, test-first for behavior under the existing
  `*.test.ts` conventions in `apps/web/src/`.
- Verification: `pnpm check` green plus eyeballing under
  `data-layout=topnav`/`focused` (Settings → Appearance → App layout) and
  at 390px — the layout axis must not break the content.
- Escape hatch: extend `LAYOUT_CATALOG` + `html[data-layout]` rules in
  `app-theme.css` rather than forking `WorkspaceShell`.

## Important Notes / NEVER Change

- Every referenced path lives under `apps/web`, and `pnpm check` is a gate
  that exists in both this monorepo and standalone checkouts — keep it
  that way when editing the prompt.
- Keep the named layouts (`sidebar`, `topnav`, `focused`) aligned with
  `LAYOUT_CATALOG` if the catalog grows.

## Change History

| Date       | Change             | Author |
| ---------- | ------------------ | ------ |
| 2026-10-06 | Initial mirror doc | Devin  |
