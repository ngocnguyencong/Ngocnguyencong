# apps/web/app/api/chat/threads/[threadId]/route.ts

## Purpose

Read, rename, and delete an owned chat thread.

## Security Fix (2026-09-27)

- Guest thread reads remain available; rename and delete require workspace write access.

## Security Fix (2026-10-03)

- Rename parses JSON through `readBoundedJson` (65,536-byte default); oversized bodies return 413 and malformed JSON returns 400. The route owns this bound because dotted dynamic IDs can bypass proxy matching.
