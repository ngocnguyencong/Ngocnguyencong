# packages/ai/src/contracts.ts

> Last updated: 2026-10-01 | Protection: STANDARD

## Purpose

Shared model, provider, requirements, and completion types for `@supastack/ai`.

## Important Notes / NEVER Change

- `AiRequest` and `ProviderCompletionRequest` accept an optional `AbortSignal`; existing callers remain valid when it is omitted.
- `throwIfAborted` throws the signal's error reason or an `AbortError` before work proceeds.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-01 | Add optional AI provider cancellation signal and abort helper | Codex |
