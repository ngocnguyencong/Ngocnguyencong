# apps/web/src/notification-bell.tsx

## Purpose
Shared web surface in this repository.

## UI foundation implementation (2026-10-06)

Shared accessible Select/Popover/Dialog behavior is integrated where applicable; shared chrome and appearance labels are localized. Workspace scope, server-authoritative actions, neutral sample content, and native form/essential reading fallbacks are preserved. Behavioral verification covers the shared primitives; live authenticated/provider flows remain outside local acceptance.

## Localized item destinations (2026-10-07)

Notification items store root-relative app routes. Their links use `localePath` for the active locale; external, protocol-relative, hash-only, and other non-root hrefs remain unchanged. The active locale matches notification copy (`locale` prop or browser cookie fallback). The footer view-all link remains supplied by the shell.
