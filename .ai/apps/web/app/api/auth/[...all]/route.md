# apps/web/app/api/auth/[...all]/route.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Better Auth (or Auth.js, engine-dependent) catch-all. Both `GET` and `POST`
use trusted-client rate windows or bounded unknown-client in-flight admission.
`POST` also buffers a bounded body before delegation.

## Important Notes

- `rateLimitResponse` is async since Task 4 — keep the `await`.
- `authjs` is lazily composed only when `AUTH_PROVIDER=authjs`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | `await rateLimitResponse` (async limiter, Task 4) | Devin |

## Current Fix (2026-10-03)

- Cause: a shared auth:ip:unknown request window can reject unrelated visitors whenever no trusted proxy address is available.
- Plan: preserve the configured per-client window for validated proxy addresses. Unknown-address requests use a fixed-size process-local in-flight gate held around the delegated GET or POST handler and released when it settles.
- No arbitrary forwarding header or attacker-controlled/random key becomes a client identity.
## Current Fix (2026-10-03, continuation)

- Before delegation, POST reads at most 65,536 bytes and forwards the original method, URL, content type, and raw JSON/form body; oversize input receives 413. This covers dotted dynamic provider paths that may not match the proxy body-size rule.
- The route strips caller-supplied x-authenticated-client-ip, injecting the header only from a validated trusted proxy address. Unknown callers use in-flight admission rather than a shared per-user-denial window.

- The in-flight gate is process-local and therefore per replica; deployments that need an aggregate concurrency cap must enforce it at trusted ingress or a shared admission layer.
