# apps/web/app/status/page.tsx

## Purpose

Public status page displaying health checks and configured provider kinds.

## Security Fix (2026-09-27)

The status page calls the shared server-only health probe directly and no longer builds a fetch URL from inbound Host or forwarded protocol.
