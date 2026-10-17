# apps/web/src/rate-limit-route.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

`rateLimitResponse(headers, limiter, prefix)` — returns a 429 `Response` with
`retry-after` + `x-ratelimit-*` headers when the limiter bucket is exhausted,
otherwise `null` so the route continues. Anonymous requests are keyed by
`rateLimitKeyForRequest` using the `trustedProxyCount` exported from
`rate-limit-runtime` — only the trusted tail of the forwarding chain keys
the bucket; untrusted/short chains share `prefix:ip:unknown`.

## Important Notes / NEVER Change

- `server-only`. Async since Task 4 — every caller does
  `const limited = await rateLimitResponse(...)`.
- Caller list (all `await`): `app/api/auth/[...all]` POST (`authLimiter`,
  `auth`), `app/api/mcp` POST + `app/api/v1/**` (`apiV1Limiter`, `api-v1`),
  `app/api/internal/scheduler-tick`, `app/api/accounts/[provider]/{connect,callback}`.
- `Limiter` param is the exported `RateLimiter` type from `./rate-limit`.
- Imports `trustedProxyCount` from `./rate-limit-runtime` (the single
  `parseServerConfig()` call site) — do not re-parse env here.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | `withTrustedClientHeader` rebuilt via `new Request(url, {method,headers,signal,body+duplex})` — `new Request(request,…)` crashes on `bound NextRequest` (`#state` private-field mismatch); this fix un-broke every `/api/auth/*` route | Devin |
| 2026-09-27 | Anonymous keys pass `trustedProxyCount` (trusted-tail XFF derivation) | Devin |
| 2026-09-23 | Async signature; `Limiter` replaced by exported `RateLimiter` (Task 4) | Devin |

## Current Fix (2026-10-03)

- Cause: requests without a trusted proxy IP share the auth:ip:unknown 30/min bucket before Better Auth, so one visitor can throttle unrelated visitors.
- Plan: preserve per-client fixed windows when TRUSTED_PROXY_COUNT yields a validated source address. Otherwise, use a bounded process-local in-flight gate around the entire delegated auth GET or POST and release the slot in finally; do not trust arbitrary headers or mint random bucket keys.
- Regression coverage: prove unknown requests skip the window, gate saturation returns 429, slots release after completion/rejection, and trusted proxy buckets still apply.
## Auth catch-all admission

- The auth catch-all removes caller-supplied x-authenticated-client-ip and sets it only when the configured trusted proxy chain resolves a valid client IP. Better Auth reads this canonical header; the client cannot provide it directly.
- Validated clients retain their per-IP auth window. Unknown callers skip a shared per-client window and enter a bounded in-flight gate spanning the delegated GET or POST handler; POST additionally holds it through body buffering. Release occurs in `finally`.

- The in-flight gate is process-local and therefore per replica; deployments that need an aggregate concurrency cap must enforce it at trusted ingress or a shared admission layer.
