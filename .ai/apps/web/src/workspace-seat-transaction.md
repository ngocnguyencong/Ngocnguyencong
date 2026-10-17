# apps/web/src/workspace-seat-transaction.ts

> Last updated: 2026-10-03 | Protection: CRITICAL

## Purpose

Shared Postgres advisory-lock boundary for workspace seat reservations. Web and
mobile invite creation, acceptance, and expired-invite renewal use the same
workspace-derived transaction lock so membership and live pending-invite counts
remain consistent across both entry points.

## Important Notes

- Acquire the transaction-scoped lock before counting seats or changing a
  reservation/membership. Keep those reads and writes in the same transaction.
- Bind the lock key to the workspace ID; never use a process-local mutex as the
  cross-request or cross-replica seat authority.
- Acceptance replaces its existing live pending reservation. Permit it when
  total seats are at or below the current plan limit; reject legacy oversubscription.
- Expired resend creates a new live reservation and must pass the same seat cap.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-03 | Added shared workspace-scoped invite seat serialization | Codex |
