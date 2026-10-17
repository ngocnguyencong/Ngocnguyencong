# src/ai-spend.test.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

SQL-capture tests for `readAiSpendForPeriod`: asserts the committed/held
filters (workspace scope, `created_at` month window, reservation period +
`"reserved"` status) and the validation errors for bad workspaceId /
periodStart.

## Important Notes

- Drizzle's `PgDialect` serializes timestamp bind parameters to ISO strings
  — expected parameter values in the assertions are ISO strings like
  `"2026-10-01T00:00:00.000Z"` even though callers pass `Date` objects.
- A mid-month `periodStart` must still produce first-of-month boundaries —
  the normalization is part of the contract.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for workspace usage controls (WP2) | Devin |
