# packages/db/drizzle/0007_eager_franklin_richards.sql

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Adds `platform_ai_spend` — daily platform-level AI spend ledger for the
public AI runner's `PUBLIC_AI_DAILY_BUDGET_MICROUNITS` cap
(`platform-ai-spend.ts`).

## Important Notes

- Spend is keyed per UTC day; the runner reserves/tallies rows so the cap
  holds across replicas.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
