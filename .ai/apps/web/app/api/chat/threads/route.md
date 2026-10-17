# apps/web/app/api/chat/threads/route.ts

## Purpose

List and create chat threads in the active workspace.

## Security Fix (2026-09-27)

- Guest thread reads remain available; thread creation requires workspace write access.
