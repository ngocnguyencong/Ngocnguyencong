# workspace-owner-transaction.test.ts

## Purpose

Verify the shared workspace transaction preserves at least one owner across
concurrent demotions, removals, and leave operations in web and mobile.

## Coverage

- The actual lock helper serializes competing owner mutations.
- Every production actor/target read, owner count, policy decision, and write
  remains inside that callback, with current actor authority read after locking.
- Tests model PostgreSQL advisory locking locally. Live PostgreSQL concurrency
  remains unverified when no test database is supplied.
