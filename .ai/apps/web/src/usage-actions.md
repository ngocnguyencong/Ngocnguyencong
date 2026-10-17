# src/usage-actions.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Server actions behind Settings → Usage (owner/admin only):
`setAiMonthlyBudgetAction(formData)` upserts
`workspace_ai_policy.monthly_budget_microunits` from a strict dollar
string (`reset=1` writes NULL → platform default / BYOK-unlimited);
`setUsageCapAction(formData)` sets or clears a `workspace_usage_cap` row
for a catalog meter key.

## Important Notes

- Gate: `requireUsageManager` = session → active workspace →
  `canManageWorkspaceMembers` — the same owner/admin check the members
  and organization settings actions use; members/guests redirect
  `?status=forbidden`, signed-out users redirect `/auth`.
- Budget input is strict: `^\d{1,6}(\.\d{1,2})?$`, max $100,000 — `1.234`,
  `-1`, `abc`, empty → `status=invalid`. Dollars convert to bigint
  microunits; `keyMode` is preserved on update, `"platform"` on insert.
- Cap input: `key` must be a `USAGE_METERS` catalog key; `cap` is an
  integer `0..MAX_USAGE_QUOTA`, empty or `clear=1` clears the row.
- Only async functions may be exported from `"use server"` modules — the
  sync parsers (`parseAiBudgetMicrounits`, `parseUsageCapInput`,
  `ParsedUsageCap`, `MAX_AI_MONTHLY_BUDGET_DOLLARS`) live in
  `usage-input.ts` and are imported here.
- Every successful write records an audit event
  (`workspaceAiBudgetUpdated` / `workspaceUsageCapUpdated`) with the
  workspace as target before redirecting `budget-saved` / `cap-saved` /
  `cap-cleared`.
- `redirect()` throws in Next — tests assert on the thrown redirect URL
  rather than a return value.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for workspace usage controls (WP2) | Devin |
