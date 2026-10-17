# packages/ai/src/providers.test.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Provider contract tests: each `SdkAiProvider` subclass resolves the key via
`ProviderKeyResolver` with its provider name and forwards generation through
the injected client — table now includes `OpenRouterProvider` → `openrouter`.
Cancellation coverage verifies an optional signal reaches the SDK client and
an already-aborted request does not resolve credentials or invoke generation.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | OpenRouterProvider row added | Devin |
| 2026-10-01 | Verify SDK signal forwarding and pre-abort handling | Codex |
