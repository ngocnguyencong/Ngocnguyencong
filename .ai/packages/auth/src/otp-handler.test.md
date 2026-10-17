# packages/auth/src/otp-handler.test.ts

## Purpose

Real Better Auth email OTP handler tests using the memory adapter and captured
mail. Cover code delivery, sign-in, verification scope, expiry, replay, and the
session-bound password setup path without database or network access.

## Open Threads / Resume Context

- **Status:** implemented (2026-10-04)
- **Result:** The fixture supplies an explicit mail-admission allow stub and
  selects the sign-in OTP independently of the expiring password proof. The
  auth package suite passes with its database-gated integration skipped.

## Important Notes / NEVER Change

- Keep Better Auth origin and CSRF checks enabled in the test configuration.
- Keep expiry tests deterministic by mutating only test-owned memory records.
- Never assert or log plaintext persisted OTP or password values.
