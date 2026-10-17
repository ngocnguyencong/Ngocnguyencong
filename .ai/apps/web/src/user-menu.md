# src/user-menu.tsx

> Last updated: 2026-09-24 | Protection: STANDARD

## Purpose

Authenticated account disclosure used by `WorkspaceShell`.

## What It Does

Loads the current session, renders a compact profile trigger, and exposes an
upward-opening menu with the account email and sign-out action. The menu closes
on outside click and Escape.

## Public API

| Name | Type | Description |
| --- | --- | --- |
| `UserMenu` | component | Locale-aware account trigger and disclosure |

## Important Notes / NEVER Change

- Keep auth client calls in this client component.
- Preserve keyboard dismissal and `aria-expanded`/`aria-controls` semantics.
- Do not add account/settings links: this surface is intentionally email +
  logout only.

## Open Threads / Resume Context

Empty — the email/sign-out-only rail disclosure is implemented and verified.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-24 | Reduced the popover to email + sign out, added `aria-controls`/Escape focus restoration, and switched to the Lucide chevron | Codex |
| 2026-09-24 | Documented lower-rail account-menu refinement | Codex |

## UI foundation implementation (2026-10-06)

Shared accessible Select/Popover/Dialog behavior is integrated where applicable; shared chrome and appearance labels are localized. Workspace scope, server-authoritative actions, neutral sample content, and native form/essential reading fallbacks are preserved. Behavioral verification covers the shared primitives; live authenticated/provider flows remain outside local acceptance.
