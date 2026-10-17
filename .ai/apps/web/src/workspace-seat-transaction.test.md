# apps/web/src/workspace-seat-transaction.test.ts

> Last updated: 2026-10-03 | Protection: CRITICAL

## Purpose

Verify that the shared Postgres workspace advisory lock serializes seat
reservations and that both web and mobile invite paths keep the quota reads and
seat-changing writes inside the lock transaction.

## Coverage

- The lock executes before the transaction callback and is keyed by workspace.
- Concurrent reservations at the last seat allow only one writer; separate
  workspaces do not block one another.
- Concurrent acceptance consumes one pending reservation exactly once, rejects
  replay, and rejects an already-over-limit legacy workspace.
- An expired resend competes for a free seat under the same lock as a new
  invitation, so the two cannot both reserve the final seat.
- Web and mobile create, accept, and resend callbacks include fresh member and
  live pending-invite reads with their corresponding writes.

## Important Notes

- The lock test database is an in-memory model of PostgreSQL transaction
  advisory-lock serialization. It does not replace a real PostgreSQL
  integration test.

## Open Threads / Resume Context

- **Status:** ready_for_next
- **Next steps:** Re-run Web typecheck after the unrelated auth type error at
  `apps/web/src/authjs-runtime.ts:334` is resolved. The in-memory lock model
  does not verify a real PostgreSQL deployment.

## Verification

- Focused invite/action/lock/mobile BFF run: 4 files, 46 tests passed.
- Scoped ESLint and targeted Prettier check passed.
- Web TypeScript check reports only the parallel auth patch's
  `emailVerified` date/null versus boolean mismatch; no seat-path diagnostics.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-03 | Created handoff before adding cross-operation seat race coverage | Codex |
| 2026-10-03 | Added expired-renewal race, replay/legacy checks, and in-lock source contracts; 46 focused tests pass | Codex |
