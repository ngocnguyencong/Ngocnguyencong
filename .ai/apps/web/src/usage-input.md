# src/usage-input.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Pure input parsers for the Settings → Usage server actions:
`parseAiBudgetMicrounits` (strict dollar string → bigint microunits,
`^\d{1,6}(\.\d{1,2})?$`, `$100,000` ceiling via
`MAX_AI_MONTHLY_BUDGET_DOLLARS`) and `parseUsageCapInput` (meter cap
integer `0..MAX_USAGE_QUOTA`, empty/`clear=1` → `clear`, anything else →
`invalid`).

## Important Notes

- Deliberately NOT `"use server"` — server-action modules may only export
  async functions, so the sync parsers live here and `usage-actions.ts`
  imports them. Tests exercise them directly (no redirect mocking).
- Both parsers return `null`/`{kind:"invalid"}` rather than throwing — the
  action maps that to the `status=invalid` redirect without a write.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Extracted from `usage-actions.ts` — server-action modules may only export async functions | Devin |
