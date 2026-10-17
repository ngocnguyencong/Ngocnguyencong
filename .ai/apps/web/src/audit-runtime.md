# apps/web/src/audit-runtime.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Append-only audit sink: `recordAuditEvent` persists
`createAuditEventRecord`/`describeAuditEvent` rows to `auditEvent`
joined with `user` actor data.

## Important Notes

- Recording is best-effort — a failure is logged and never blocks the
  product action that produced the event.
- IP is taken from `x-forwarded-for` first hop unless the caller supplies
  `ipAddress`.
- Connected-account connect/disconnect/refresh and schedule upsert/remove
  all audit through this sink (added on the branch).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Connected-account/schedule audit callsites merged via feat/prod-ready-kit — initial mirror | Devin |
