# apps/web/app/api/chat/threads/[threadId]/route.test.ts

## Purpose

Route-level regressions for the owned chat-thread handler.

## Security Fix (2026-10-03)

Tests prove a dotted thread ID cannot make PATCH parse an actual streamed JSON body over the shared limit, even with a dishonest short content-length; the route returns 413 without renaming. Valid and malformed JSON retain their 200/400 behavior.
