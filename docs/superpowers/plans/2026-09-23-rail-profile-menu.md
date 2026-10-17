# Rail Profile Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Relocate the workspace profile control to the lower-left rail and expose an upward email/logout menu.

**Architecture:** Refine the existing `UserMenu` client boundary rather than adding another auth component. `WorkspaceShell` owns placement; `app-theme.css` owns responsive presentation.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Lucide, CSS, Vitest/jsdom.

---

### Task 1: Pin rail placement and menu content

**Files:**

- Modify: `apps/web/src/workspace-switcher.test.ts`
- Create: `apps/web/src/user-menu.test.tsx`

- [ ] **Step 1: Write failing contracts**

Assert `UserMenu` occurs after `app-rail-footer` and before `</aside>`, is absent
from `main-header-actions`, and the opened menu contains the email plus `Sign out`
without account/settings/docs links.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm --filter @supastack/web test -- src/workspace-switcher.test.ts src/user-menu.test.tsx`

Expected: FAIL against current header placement and extra links.

### Task 2: Refine and relocate UserMenu

**Files:**

- Modify: `apps/web/src/user-menu.tsx`
- Modify: `apps/web/src/app-chrome.tsx`
- Modify: `apps/web/app/app-theme.css`

- [ ] **Step 1: Implement minimal content and semantics**

Remove settings/docs href calculations and link navigation from `UserMenu`.
Render email plus the sign-out button, add `aria-controls`, use Lucide icons,
and restore trigger focus on Escape.

- [ ] **Step 2: Move it into a rail account slot**

Render `<UserMenu locale={locale} />` after the auxiliary footer and before the
aside closes; remove it from header actions without changing notification/help.

- [ ] **Step 3: Adapt token styles**

Make the trigger a 40px-minimum compact rail control, set the popover to
`bottom: calc(100% + 8px)`, wrap email text, and keep `.app-rail-account`
visible at 760px while auxiliary links remain hidden.

- [ ] **Step 4: Run focused tests and typecheck**

Run focused Vitest, then `pnpm --filter @supastack/web typecheck`.

Expected: both exit 0.

### Task 3: Browser verification and handoff

**Files:**

- Modify: `.ai/apps/web/src/app-chrome.md`
- Modify: `.ai/apps/web/src/user-menu.md`
- Modify: `.ai/apps/web/src/workspace-switcher.test.md`
- Modify: `.ai/apps/web/app/app-theme.md`
- Modify: `.ai/PROJECT_CONTEXT.md`

- [ ] **Step 1: Inspect desktop and 320px states**

Verify lower-left placement, upward opening on desktop, long-email wrapping,
keyboard dismissal/focus, and no 320px overflow.

- [ ] **Step 2: Re-run focused verification**

Run focused Vitest and web typecheck after any browser-found fixes.

- [ ] **Step 3: Sync `.ai/` docs**

Clear only this task's open threads and preserve unrelated working changes.
Do not commit, sync subrepos, push, deploy, or publish without explicit consent.
