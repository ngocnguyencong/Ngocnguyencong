# apps/web/src/chat-budget.test.ts

## Purpose

Focused tests for synchronous chat provider authorization, budget denial before
provider use, actual usage accounting, failed-attempt release, and retention of
the winning hold when usage cannot be persisted.

## Coverage

Also verifies optional cancellation reaches the router and an authorized hold
is released when the provider attempt aborts.
