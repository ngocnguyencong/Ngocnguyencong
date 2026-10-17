# apps/web/src/chat-api.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Resolves a signed-in user's active workspace for chat and scopes chat records to that user and workspace.

## Open Threads / Resume Context

- `resolveChatScope(userId, "write")` checks the role of the selected workspace; read callers still use the default scope. Every chat mutation and stream route requests write access, so guest reads and member writes remain available.
