# apps/web/app/api/chat/stream/route.ts

## Purpose

Authenticated SSE chat completion endpoint.

Passes `request.signal` to the stream runtime after auth, workspace write-scope,
JSON, and prompt validation. A stopped client can cancel budgeted provider
generation.

## Security Fix (2026-09-27)

- Resolves the selected workspace with write access before invoking shared AI resources.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-01 | Forward the incoming request abort signal into chat streaming | Codex |
