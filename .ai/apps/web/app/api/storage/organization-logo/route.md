# apps/web/app/api/storage/organization-logo/route.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Organization logo upload route with workspace manager checks.

## Open Threads / Resume Context

- This route re-exports the logo POST handler, so it inherits the manager check and shared 2.5 MiB total request cap.
