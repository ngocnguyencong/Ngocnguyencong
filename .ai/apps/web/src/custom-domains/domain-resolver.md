# apps/web/src/custom-domains/domain-resolver.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

`resolveWorkspaceByHost(host)` → the active domain's workspace brand
`{ workspaceId, name, logoUrl }`, with a bounded LRU in-memory cache;
positive entries live 60 seconds, misses use a shorter negative TTL, and
concurrent unique lookups have a cap. Add/remove actions invalidate entries.
Used by `getRequestBrand` and the Better Auth trusted-origins hook.

## Security Notes

- Host-derived keys are length-limited before lookup. Cache cardinality and
  concurrent database lookups are bounded; expired entries are pruned and
  least-recently-used entries evicted.
- Invalidation marks pending lookups stale without freeing their in-flight
  slots. When a stale result resolves, callers retry instead of caching old
  ownership, and the concurrency cap still counts the original DB work.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-03 | Discard in-flight resolver results that finish after invalidation | Codex |
| 2026-10-03 | Bound hostname cache/inflight lookups and shorten negative TTL | Codex |
| 2026-09-22 | Initial resolver (phase B3) | Devin |
