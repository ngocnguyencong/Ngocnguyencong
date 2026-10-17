# apps/web/src/rate-limit.ts

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

Fixed-window rate limiting primitives: the `RateLimiter` interface
(`check(key): Promise<RateLimitResult>`), an in-memory implementation, a
shared-store implementation, and `rateLimitKeyForRequest` key derivation.

## What It Does

- `createRateLimiter({ limit, windowMs, now?, maxBuckets? })` — per-process
  Map-backed limiter (tests + non-production default). `check` is async
  since Task 4. A non-finite `maxBuckets` throws at construction — a
  NaN/Infinity config would silently disable the distinct-key cap.
- `createStoreRateLimiter({ name, limit, windowMs, store, now?, onStoreError?, failClosed? })`
  — delegates to `store.hit(`${name}:${key}`, windowMs, now)` and maps the
  hit to `RateLimitResult`: `allowed = count <= limit`,
  `remaining = max(0, limit - count)`,
  `retryAfterSeconds = allowed ? 0 : ceil((expiresAt - now)/1000)`.
  Store failures fail open by default (`allowed: true`, full `remaining`)
  and call `onStoreError` once per failed check. Side-effecting gates can
  opt into `failClosed` to deny when the store is unavailable.
- `clientIpForRequest(headers, trustedProxyCount?)` — the client IP as
  observed by the outermost trusted proxy (same XFF tail-entry rule as the
  anonymous bucket key); `"unknown"` when no trustworthy chain exists.
  Extracted 2026-10-10 so the analytics collect path hashes the identical
  IP signal the limiter keys on.
- `rateLimitKeyForRequest(headers, { prefix, trustedProxyCount?, userId?, workspaceId? })` —
  `prefix:workspace:<id>` / `prefix:user:<id>` / `prefix:ip:<client|unknown>`.
  Anonymous keys take the `x-forwarded-for` entry `trustedProxyCount` hops
  from the right (default 0 = no trusted forwarding entry for a directly
  exposed app); leading entries are client-controlled and never move the key.
  Missing/short/malformed chains → shared `prefix:ip:unknown` bucket; a
  trailing `:port` is normalized off IPv4 tokens (IIS/ARR rotation).

## Public API

- `RateLimitResult = { allowed, limit, remaining, retryAfterSeconds }`
- `RateLimiter = { check(key): Promise<RateLimitResult> }`
- `RateLimitStore = { hit(key, windowMs, now: Date): Promise<{ count, expiresAt }> }`
  — satisfied by `createPostgresRateLimitStore` from `@supastack/db`.

## Dependencies

- No imports. Consumed by `rate-limit-route.ts` (429 helper) and
  `rate-limit-runtime.ts` (store selection + named limiters).

## Important Notes / NEVER Change

- The interface is async — every caller must `await limiter.check(...)`.
- Fail-open path must not include the bucket key in `onStoreError` payloads
  (keys can embed user/workspace ids).

## Open Threads / Resume Context

- Anonymous keys trust exactly `TRUSTED_PROXY_COUNT` XFF hops from the right
  (env → `rateLimit.trustedProxyCount` → `rate-limit-runtime.trustedProxyCount`
  → `rateLimitResponse`; default 0 — trust nothing until the deployment
  declares its proxy count). Setting it higher than the real proxy count
  hands the key back to attacker-controlled entries; setting it lower
  degrades to the shared `unknown` bucket. Explicit user/workspace IDs still
  take precedence over any header.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-10 | +`clientIpForRequest`; `rateLimitKeyForRequest` anonymous branch refactored onto it (same semantics) | Devin |
| 2026-09-27 | `rateLimitKeyForRequest` reads the trusted tail of XFF only when explicitly configured (`trustedProxyCount` default 0) → `prefix:ip:<entry|unknown>` | Codex |
| 2026-09-27 | Non-finite `maxBuckets` throws (fail loud over silently disabling the cap) | Devin |
| 2026-09-23 | `check` made async; +`createStoreRateLimiter`, `RateLimiter`, `RateLimitStore` (Task 4, feat/prod-ready-kit) | Devin |

## Security Fix (2026-09-27)

The shared-store limiter has an optional `failClosed` mode for side-effecting
security gates; existing callers retain fail-open behavior. The in-memory
limiter caps distinct buckets at 10,000 (or a smaller configured test limit),
reclaims expired entries when full, and denies new keys until space opens.

Second pass: anonymous keys were briefly a single `anonymous` bucket because
first-entry XFF is fully spoofable — but that collapsed every visitor into
one quota. Keys now derive from the entry `trustedProxyCount` hops from the
right (the position a trusted proxy wrote), so prepended/rotated leading
entries cannot move the key and per-source limits bind again. The default is
0 — trust nothing — because an unconfigured proxy-less deployment would
otherwise hand key control back to the client; operators set
`TRUSTED_PROXY_COUNT` to their real hop count to get per-IP buckets.
