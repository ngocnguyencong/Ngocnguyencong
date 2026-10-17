# src/purchases/revenuecat-identity.test.ts

> Last updated: 2026-10-01 | Protection: STANDARD

## Purpose

Verifies SDK identity switching is serialized with in-flight store operations.

## Important Notes / NEVER Change

- A queued workspace switch must wait for the current operation to finish.
- A failed identity setup must not run the operation.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-01 | Cover in-flight workspace switch and setup failure | Codex |
