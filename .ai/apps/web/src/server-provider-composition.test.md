# apps/web/src/server-provider-composition.test.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Offline composition tests (15): per-provider scenario table asserts the right
`AiProvider` class + configured platform key flows to `generateText` through
injected client factories — now including `openrouter` via
`createOpenRouterClient`. Billing cases sign real webhook payloads for
each adapter (Stripe fixture, Creem hex HMAC, Standard Webhooks for
polar/whop/dodo, `ts;h1` for paddle, injected `createPaypalClient` verify
stub for paypal).

Provider tests also verify the selected AI SDK generation path receives the
provider AbortSignal as `abortSignal`; cancellation coverage does not change
billing or email composition scenarios.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | `import()` type annotations in `vi.mock` factories swapped for `import type * as` namespace types (`consistent-type-imports` lint gate) | Devin |
| 2026-09-25 | paddle/dodo/paypal composition + webhook-verify scenarios | Devin |
| 2026-09-22 | Offline factory tests for polar/whop billing + email-sdk provider kinds | Devin |
| 2026-09-23 | OpenRouter scenario added | Devin |
