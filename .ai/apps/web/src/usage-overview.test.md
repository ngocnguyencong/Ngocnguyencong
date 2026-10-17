# src/usage-overview.test.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Unit tests for `getWorkspaceUsageOverview` with fully injected
dependencies: bigint → decimal-string serialization, `isDefaultBudget`
for explicit vs platform-default budgets, BYOK `null` budget, the
meter rows' plan-limit/cap/effective-limit trio, and period boundaries.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for workspace usage controls (WP2) | Devin |
