# packages/db/src/index.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Barrel export for `@supastack/db`: schema, postgres lifecycle, provider
credentials, workspace repositories, workspace helpers, notifications, audit,
rate-limit store, platform AI spend, credits ledger, push tokens, analytics
events.

## Important Notes

- `export *` order is historical; new modules append at the end.
- `rate-limit-store` (Task 4) and `platform-ai-spend` (Task 6) were added on
  `feat/prod-ready-kit` — both are raw-SQL helpers typed on
  `PostgresJsDatabase<typeof schema>`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | +`./push-tickets` (`PushTicketRepository` — record/listDue/remove/removeOlderThan for Expo receipt reconciliation) | Devin |
| 2026-10-16 | +`./migrations` (`listPendingMigrations`: journal tags vs `drizzle.__drizzle_migrations`) + `./migration-journal` (embedded journal entries for /setup readiness) | Devin |
| 2026-10-16 | +`./usage-caps` (`workspace_usage_cap` repository: owner-set meter caps) + `./ai-spend` (`readAiSpendForPeriod`: shared committed/held monthly spend read) | Devin |
| 2026-10-15 | +`./user-appearance` (`user_appearance` repository: per-user synced appearance snapshot) | Devin |
| 2026-10-11 | +`./analytics-events` (`analytics_event` repository: `record` + `summarizeSiteTraffic`) | Devin |
| 2026-10-11 | +`./credits` (prepaid workspace credit balance + ledger repository) | Devin |
| 2026-10-10 | +`./push-tokens` (`device_push_token` repository for Expo push) | Devin |
| 2026-09-23 | +`./rate-limit-store` (Task 4), +`./platform-ai-spend` (Task 6) | Devin |

## Security Fix (2026-09-27)

Exports the effective AI budget helper for the web runtime and repository authorization path.
