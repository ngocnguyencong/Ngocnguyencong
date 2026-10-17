# apps/web/app/api/storage/avatar/route.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Authenticated workspace avatar upload route with role, MIME, and file-size checks.

## Open Threads / Resume Context

- Multipart parsing now follows the shared 2.5 MiB total request cap. The existing 2 MiB file check and guest prohibition remain.
- Upload admission is checked after authentication/workspace resolution and before multipart parsing. It uses fail-closed per-user, per-workspace, and global fixed-window buckets.
- Avatar replacement uses a stable workspace/user key under a database advisory lock, upserts one metadata row, and performs bounded cleanup of legacy avatar objects scoped to that workspace and user.
