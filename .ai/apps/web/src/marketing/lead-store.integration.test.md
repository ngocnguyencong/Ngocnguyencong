# apps/web/src/marketing/lead-store.integration.test.ts

> Last updated: 2026-09-21 | Protection: STANDARD

## Purpose

Real-Firestore lane for `lead-store.ts`, same convention as
`packages/db/postgres.integration.test.ts`: self-skips unless
`FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`
are set. Included in the default vitest run (skips cleanly in CI).

## Important Notes

- Uses a unique `lead-itest-{timestamp}@example.com` probe email and
  deletes every doc it created via an Admin SDK cleanup in `finally` —
  safe to run against a shared dev project, but point creds at a
  throwaway database when possible.
- Verified live 2026-09-21 against a real Firestore project:
  create → `created`, re-save → `duplicate`, cleanup confirmed via REST.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-21 | Initial integration test | Devin |
