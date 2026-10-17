# packages/auth/src/magic-link-handler.test.ts

## Purpose

Real Better Auth magic-link handler coverage using the memory adapter and
captured transactional delivery; no live provider, network, or database.

## Open Threads / Resume Context

- **Status:** implemented (2026-10-04)
- **Result:** The memory-adapter fixture includes explicit mail admission;
  magic-link behavior remains covered without live provider or database calls.

## Important Notes / NEVER Change

- Do not assert plaintext token persistence.
- Keep origin and CSRF checks enabled.
