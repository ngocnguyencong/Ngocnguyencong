# apps/web/src/rate-limit.test.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Unit tests for `rate-limit.ts`: memory limiter window/block/rollover (all
awaited since the interface went async), `createStoreRateLimiter` mapping +
namespacing + fail-open/`onStoreError`, and `rateLimitKeyForRequest`
identity/IP precedence.

## Important Notes

- Store is a `vi.fn` stub — no Postgres needed; the real store's atomicity is
  covered by `packages/db/src/rate-limit-store.integration.test.ts`.
- Fail-open test asserts `onStoreError` fired exactly once per failing check
  with the thrown `Error`.

## Open Threads / Resume Context

- Rotated *leading* XFF entries produce the same `ip:` key (the trusted tail
  is counted from the right); user/workspace IDs still choose their own
  buckets. Cases pin: safe default = shared unknown, explicitly trusted
  single and multi-proxy counts, short or empty chains → `ip:unknown`, non-IP tokens →
  `unknown`, `ipv4:port` normalization.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | `rateLimitKeyForRequest` describe rewritten for trusted-tail XFF keys (spoofed prefixes, proxy count, unknown/garbage fallbacks) | Devin |
| 2026-09-27 | +expired-key reuse at maxBuckets; +non-finite `maxBuckets` constructor throw | Devin |
| 2026-09-23 | Async `check` + store-limiter describe block (Task 4) | Devin |

## Security Fix (2026-09-27)

Tests verify the opt-in fail-closed store-error result, the existing fail-open
default, in-memory distinct-key capacity, and expiry reclamation.
