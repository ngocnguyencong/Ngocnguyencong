# src/feature-board.test.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Unit tests for the pure feature-board module (`feature-board.ts`) — status
guard, input normalization, status-change decisions, vote counter math.

## Coverage

- `isFeatureRequestStatus` accepts all six statuses, rejects junk.
- `normalizeFeatureRequestInput` trims, requires 1–200 title, caps details
  at 5000, defaults missing details to `""`.
- `evaluateFeatureStatusChange` → ok / invalid / unchanged.
- `nextVoteCount` increments, decrements, floors at 0.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-22 | Created with the feature board module | Devin |
