# apps/web/src/chat-budget.ts

## Purpose

Server-only budgeted completion for synchronous chat. It creates a
workspace-scoped task ledger row, estimates usage, reserves the effective
monthly budget before each provider attempt, records actual usage, and settles
the winning hold. Earlier failed-attempt holds are released. A provider is
never called when authorization fails. If actual usage cannot be recorded,
the winning hold remains reserved to prevent a free budget reset. Token
counts are clamped through the executor's shared `safeTokenNumber`
(Postgres integer range) alongside `estimateConservativeUsage`.

`BudgetedChatInput.signal` is forwarded to the router and checked around
workspace context resolution. If a provider attempt is cancelled, the failed
task is recorded and outstanding pre-provider budget holds are released; a
successful provider result keeps its hold reserved if usage persistence fails.
