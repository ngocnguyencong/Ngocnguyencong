# src/usage-overview.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Server-only assembly of the workspace usage overview rendered by Settings
→ Usage and `GET /api/mobile/usage`. `getWorkspaceUsageOverview(
workspaceId, now, dependencies?)` combines, for the UTC month containing
`now`: the `workspace_ai_policy` row (via `effectiveAiMonthlyBudget` —
explicit budget, platform default, or BYOK-unlimited `null`), committed +
held AI spend via the shared `readAiSpendForPeriod`, per-meter
`{used, planLimit, cap, limit}` from `getQuota`, and the prepaid credit
balance. `loadUsagePanelData` wraps it with `requireWorkspaceViewer` for
the settings pages.

## Important Notes

- Bigints serialize to decimal strings (`budgetMicrounits`,
  `committedMicrounits`, `heldMicrounits`) — the shape crosses both the
  RSC boundary and the mobile JSON API.
- `isDefaultBudget` distinguishes "no explicit budget, platform default
  applies" from an owner-set budget; BYOK reports `budgetMicrounits: null`.
- `readAiSpend` defaults wrap `readAiSpendForPeriod(database, …)` — the
  same query the budget-enforcement transaction uses — never duplicate the
  spend SQL in web code.
- Every read is injectable (`UsageOverviewDependencies` extends
  `UsageQuotaDependencies`) so tests never touch the database.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for workspace usage controls (WP2) | Devin |
