# production-reference-app.tsx

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Production reference console for authenticated, durable AI task execution —
mounted at `/ai` (canonical) and `/{locale}/ai`. Its internal shell marks the
"AI task" item active on `/ai`; the "Dashboard" item is a plain link to the
analytics product at `/dashboard`. `githubCallbackURL` returns OAuth linking
to the mounted route.

## 2026-09-23 — generic GitHub link card

- Renders the generic GitHub identity/linking card after workspace metrics.
- Contains no license mapping, collaborator invites, or repository access checks.

## UI foundation implementation (2026-10-06)

Approved: reuse accessible themed controls and shared motion/status tokens; localize shared chrome/appearance labels. Preserve workspace scope, server-authoritative actions, neutral demo content, and no-JavaScript form/reading paths. Verify focused regressions and update this handoff after integration.

## Responsive shell

The console uses the shared `ShellNavigation` frame for desktop rail and
mobile modal drawer presentation. Keep its existing navigation links and
actions inside the passed sidebar/content slots; the shell changes framing
only. Server-rendered navigation stays visible until client enhancement. The
task grid carries no anchor id — e2e locates it via the `.task-grid` class.
