# apps/web/app/api/storage/logo/route.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Organization logo upload route for authorized workspace managers.

## Open Threads / Resume Context

- Multipart parsing now follows the shared 2.5 MiB total request cap. Manager authorization and the existing 2 MiB file check remain.
- Upload admission is checked after manager authorization and before multipart parsing. It uses fail-closed per-user, per-workspace, and global fixed-window buckets.
- Logo replacement uses a stable workspace key shared by the API and server-action upload paths, serializes replacement with a database advisory lock, upserts one metadata row, and performs bounded workspace/purpose-scoped cleanup of legacy logo objects.
