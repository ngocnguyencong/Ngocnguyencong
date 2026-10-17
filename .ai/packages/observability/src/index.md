# packages/observability/src/index.ts

> Last updated: 2026-09-29 | Protection: STANDARD

## Purpose

Vendor-neutral observability contracts: `redactSensitive` (recursive key
redaction over /authorization|cookie|credential|password|secret|token|
api[_-]?key/i), `createStructuredLogger` (redacted records via sink),
`createObservability` ({`track`, `captureException`} over analytics/error
clients, `workspaceId`-scoped), failure alerting (`AlertSeverity`,
`AlertEvent`, `AlertClient`, `Alerting`, `createAlerting`),
`newCorrelationId` (`corr_<uuid>`) + `isCorrelationId` (the shared
validator — non-empty string after trim, ≤255 chars), and `startTimer`
(`elapsedMs` primitive).

## Important Notes / NEVER Change

- `createAlerting.alert` must NEVER throw into product code: `context` is
  redacted before `client.send`, a synchronous throw is caught, and an
  async rejection is swallowed via `.catch(() => {})`. Delivery failures
  are NOT logged here — the runtime layer owns logging.
- `ErrorContext` requires `workspaceId`; error payloads pass through the
  private `sanitizeError` (generic message + safe error name) so provider
  secrets never reach the error client.
- No runtime dependencies — keep the package vendor-neutral.
- `newCorrelationId` returns `corr_${randomUUID()}` (node:crypto); the id
  travels in event properties / error extras / job+webhook payloads — no
  DB column. `isCorrelationId` is the single shared guard for
  caller/payload-supplied ids — malformed values are dropped and a fresh
  id minted, never propagated. Import it here, never re-implement.
- `startTimer` uses `performance.now()` (injectable `now`); duration
  composition lives in the web runtime, not here.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-29 | `+=` `isCorrelationId` — consolidates 4 duplicated local guards in apps/web | Devin |
| 2026-09-29 | `+=` `AlertSeverity`/`AlertEvent`/`AlertClient`/`Alerting`/`createAlerting`, `newCorrelationId`, `startTimer` (correlation/alerting primitives) | Devin |
| 2026-09-04 | Initial contracts: `redactSensitive`, `createStructuredLogger`, `createObservability` | Devin |
