# apps/web/src/public-ai.test.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

`createPublicAiRunner` unit tests with a stub `StructuredRouter` (invokes
`beforeProviderAttempt` like `ModelRouter`, queues texts, optional throw) and
`vi.fn` spend deps: platform workspace shape, `TypeError` without
`estimatedUsage`, reserve amount = `calculateModelCost(price,
estimatedUsage)`, `PublicAiBudgetExceededError` on reserve-false and on
`0n` budget (router untouched), release on provider failure, and
per-structured-attempt reservations and settlement. A schema repair must charge
both successful provider responses. Exhausted-schema retries retain their actual
cost and cannot reuse the same daily allowance indefinitely.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Created (Task 6, feat/prod-ready-kit) | Devin |
