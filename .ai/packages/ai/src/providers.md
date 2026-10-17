# packages/ai/src/providers.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

`AiProvider` implementations: `FakeAiProvider` (deterministic local),
`SdkAiProvider` base (resolves BYOK/platform keys through
`ProviderKeyResolver`, delegates generation to a `ProviderSdkClient`), and
subclasses `OpenAiProvider`, `AnthropicProvider`, `OpenRouterProvider`,
`OpenAiCompatibleProvider`.

## Important Notes / NEVER Change

- `OpenRouterProvider` is a plain `SdkAiProvider` with provider name
  `"openrouter"` — the OpenRouter SDK client lives in the web composition
  layer (`server-provider-composition.ts`), keeping `packages/ai`
  SDK-agnostic.
- Provider names double as BYOK credential scope identifiers.
- SDK-backed adapters check for cancellation before credential lookup and again
  before generation, then forward the optional signal to the SDK client. When
  aborted, they preserve the cancellation error rather than wrapping it as a
  retryable provider failure.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | `OpenRouterProvider` added | Devin |
| 2026-10-01 | Forward optional abort signal through SDK-backed adapters | Codex |
