# apps/web/src/rate-limit-runtime.ts

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

Server-only composition root for rate limiting. Exports
`createNamedRateLimiter(name, limit, windowMs, { failClosed? })`, the
`trustedProxyCount` env value for `rateLimitKeyForRequest`, plus
shared API, auth, lead, and AI task limiters.

## What It Does

- Reads `serverConfig.rateLimit.store` (`RATE_LIMIT_STORE`; defaults to
  `postgres` when `NODE_ENV=production`, else `memory`).
- Re-exports `serverConfig.rateLimit.trustedProxyCount` (`TRUSTED_PROXY_COUNT`,
  0–10, default 0) as `trustedProxyCount` — the env is read once here so
  `rate-limit-route.ts` can pass it to `rateLimitKeyForRequest`.
- `postgres` → `createStoreRateLimiter` over
  `createPostgresRateLimitStore(database)` (shared `database` from
  `auth-runtime`); `memory` → in-process `createRateLimiter`.
- `onStoreError` → `serverObservability.captureException` with
  `{ operation: "rate-limit.store", workspaceId: "platform" }` — the
  `workspaceId` sentinel satisfies `ErrorContext`; bucket keys are never
  included in the payload.

## Important Notes / NEVER Change

- Imports `database` from `./auth-runtime` (established shared-pool pattern).
- `createNamedRateLimiter` is the public seam for new limiters — products
  built on the kit wire their own routes through it.

## Change History


| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | +`exportDownloadLimiter` (`export-download`, 10/min per trusted client IP, fail-open) — bounds the heavy `GET /api/workspace/export` read | Devin |
| 2026-10-10 | +`analyticsCollectLimiter` (600/min per trusted client IP, fail-open like other telemetry) for `POST /api/analytics/collect` | Devin |
| 2026-09-27 | +`trustedProxyCount` export (`TRUSTED_PROXY_COUNT` → `rateLimit.trustedProxyCount`) for `rateLimitResponse` key derivation | Devin |
| 2026-09-23 | Store-selected limiters + `createNamedRateLimiter` (Task 4) | Devin |

## Security Fix (2026-09-27)

Anonymous auth/API/OAuth quotas key on the client IP `TRUSTED_PROXY_COUNT`
XFF hops from the right (leading entries are spoofable and never trusted);
requests without a trustworthy chain share the bounded `unknown` bucket, and
the fail-closed store behavior is unchanged. PayPal webhook verification has
a separate fail-closed global quota.

Public lead submissions use only the existing 100/hour global quota; the obsolete 5/hour source limiter was removed when anonymous forwarding headers stopped providing a trustworthy source key.

Named fail-closed limiters now gate public leads and AI task submissions on the configured shared Postgres store in production.

Public lead and waitlist writes now share an additional 5/hour client bucket
when `TRUSTED_PROXY_COUNT` yields a validated source IP. Both buckets are
fail-closed; without a trusted source identity the existing 100/hour global
bucket still bounds submissions.

## Current Fix (2026-10-03)

- Plan: export a bounded in-flight gate for unknown-IP auth POST requests. The catch-all holds each slot until the delegated handler settles; existing Better Auth and per-recipient transactional email controls remain in their owning modules.