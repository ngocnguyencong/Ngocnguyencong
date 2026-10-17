# apps/web/src/public-ai-runtime.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Server-only composition root for the public AI boundary. `getPublicAiRunner()`
lazily builds `createPublicAiRunner` over `getChatStreamRuntime().router`
(`ai-task-runtime.ts`), the shared `database` (`auth-runtime.ts`), the
`platform-ai-spend` drizzle functions, and
`serverConfig.publicAi.dailyBudgetMicrounits` (`PUBLIC_AI_DAILY_BUDGET_-
MICROUNITS`, default `0n` = disabled).

## Important Notes

- The spend `limit` is bound into the `reserve` closure — the runner's deps
  carry `dailyBudgetMicrounits` separately so the `0n` gate fires before the
  router is touched.
- Composition is lazy so importing this module never opens a DB connection or
  builds providers.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Created (Task 6, feat/prod-ready-kit) | Devin |
