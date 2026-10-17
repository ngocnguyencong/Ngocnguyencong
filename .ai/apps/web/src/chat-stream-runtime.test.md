# apps/web/src/chat-stream-runtime.test.ts

## Purpose

Focused SSE runtime regression coverage for shared AI submission limits.

## Coverage

An exhausted user bucket emits an SSE error without calling the budgeted
completion helper or consuming the workspace bucket.

Cancellation tests verify request/consumer abort reaches completion, skips the
assistant append when observed before persistence, and ends without an SSE error
frame or post-abort chunks.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-01 | Verify request and consumer cancellation paths | Codex |
