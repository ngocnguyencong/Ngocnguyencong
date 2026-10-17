# packages/observability/src/index.test.ts

> Last updated: 2026-09-29 | Protection: STANDARD

## Purpose

Observability contract tests (10): recursive `redactSensitive`, structured
logger shape + redaction, workspace-scoped track/captureException with
error sanitization, alert-context redaction, absent-context forwarding
(no `context` key reaches `client.send`), swallowed alert-client
sync throw + async rejection, `corr_`-prefixed uuid correlation-id
uniqueness/format, `isCorrelationId` boundary validation (valid id,
255-char edge, empty/whitespace/oversized/non-string/null rejects), and
`elapsedMs` pinned to `now() - startedAt` via an injected clock.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-29 | `+=` `isCorrelationId` validation table (9 → 10) | Devin |
| 2026-09-29 | Timer test made deterministic via injected `now` (`elapsedMs` === `now() - startedAt`); `+=` absent-context alert test (8 → 9) | Devin |
| 2026-09-29 | `+=` alerting (redaction, swallowed throw/rejection), correlation-id, timer tests (4 → 8) | Devin |
| 2026-09-04 | Initial redaction/logger/observability tests | Devin |
