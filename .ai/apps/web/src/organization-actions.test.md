# apps/web/src/organization-actions.test.ts

> Last updated: 2026-10-03 | Protection: CRITICAL

## Purpose

Regression tests for organization invite quotas, pending invite actions, and
member management behavior exposed by the web server actions.

## Coverage

- Seat-limit outcomes at under, exact, and over-capacity counts, including the
  unlimited plan case.
- The settings page displays quota and invitation action outcomes.
- Invite creation rejection reasons stay aligned with the typed server result;
  the action interpolates these reasons into its status URL.
- Pending invite revoke/resend and member removal entry points retain their
  role guards and result states.

## Important Notes

- Advisory-lock ordering and concurrent reservation behavior are exercised in
  `workspace-seat-transaction.test.ts`; keep this suite focused on the web
  action contract and visible status behavior.

## Verification

- Focused invite/action/lock/mobile BFF run: 4 files, 46 tests passed.
- Scoped ESLint and targeted Prettier check passed.
- Web TypeScript check is currently blocked by the parallel auth change at
  `apps/web/src/authjs-runtime.ts:334` (`emailVerified` date/null versus
  boolean); no errors remain in the seat transaction test.

## Open Threads / Resume Context

- **Status:** ready_for_next
- **Next steps:** Re-run Web typecheck after the auth type error is resolved.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-03 | Created handoff before tightening the invitation quota regression contract | Codex |
| 2026-10-03 | Pin typed invite rejection reasons and status interpolation; focused suite passes | Codex |
