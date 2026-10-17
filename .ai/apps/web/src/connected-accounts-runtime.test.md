# apps/web/src/connected-accounts-runtime.test.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Composition tests for `connected-accounts-runtime.ts`.

## Coverage

- The first test loads the runtime cold after environment stubs; a full-suite
  Windows run timed out during that import at the default 5 seconds, while an
  isolated run passed. Only that test now allows 15 seconds; the full suite
  passed after the change.
- Maps provider env config onto `ConnectedAccountProviderConfig` (enabled
  when id [+secret] present; X public-client tolerated).
- Re-exports the SMTP identity helper for the save action.
- Invalid `CREDENTIAL_ENCRYPTION_KEY` maps to a generic callback error —
  never a crypto stack trace.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
