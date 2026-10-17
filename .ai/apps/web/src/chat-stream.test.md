# apps/web/src/chat-stream.test.ts

## Purpose

Source contract checks for the chat SSE route, model path, message ordering,
and fallback UI.

## Security Fix (2026-09-27)

The source contract now checks for the budgeted completion helper and shared
submission limits while preserving SSE and chat message ordering assertions.

## Open Threads / Resume Context

- **Status:** in_progress
- **Intent:** Extend source contract assertions to require route signal forwarding and provider abort wiring.
- **Next steps:** Add source checks only after runtime/provider behavior tests cover cancellation.
