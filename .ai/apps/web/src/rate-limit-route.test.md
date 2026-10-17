# apps/web/src/rate-limit-route.test.ts

> Last updated: 2026-10-03 | Protection: CRITICAL

## Purpose

Verify anonymous auth request admission for trusted and unknown client addresses.

## Planned Coverage

- Unknown-address requests use a bounded in-flight gate instead of a shared per-client window.
- Saturation returns 429; slots remain held during handler execution and release after completion or rejection.
- Validated trusted proxy addresses retain the existing per-client fixed window.
- A forged canonical-IP header is stripped; trusted ingress resolution overwrites it with the trusted client IP. Unknown requests continue beyond 30 sequential requests while still respecting the active-handler gate.
