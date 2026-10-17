# apps/web/src/custom-domains/domain-resolver.test.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Unit tests for the resolver: active-domain lookup, TTL positive and
negative caching, and cache invalidation on mutations.
Also pins normalized host length rejection, negative TTL, LRU/cardinality
eviction, expiry pruning, and the in-flight unique lookup cap.
- Invalidation during a pending read retries without caching stale results or
  freeing the in-flight lookup slot early.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-03 | Cover invalidation racing an in-flight lookup | Codex |
| 2026-10-03 | Add negative TTL, bounded-cache, and inflight-cap regressions | Codex |
| 2026-09-22 | Initial tests (phase B3) | Devin |
