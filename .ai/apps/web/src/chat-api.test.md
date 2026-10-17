# apps/web/src/chat-api.test.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Focused regression tests for active workspace chat scope and guest role enforcement.

## Open Threads / Resume Context

- Tests select a guest organization alongside an owner personal workspace: guest read succeeds, guest write fails, and member write succeeds.
