# apps/web/app/api/chat/threads/[threadId]/messages/route.test.ts

## Purpose

Route-level regressions for appending a message to an owned chat thread.

## Security Fix (2026-10-03)

Tests prove a dotted thread ID cannot make POST parse an actual streamed JSON body over the shared limit, even with a dishonest short content-length; the route returns 413 without appending. Valid and malformed JSON retain their 201/400 behavior.
