# apps/web/src/public-ai.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Anonymous/public AI boundary: `createPublicAiRunner(deps)` wraps the model
router so every provider attempt reserves platform daily budget
(`platform_ai_spend`, UTC `YYYY-MM-DD`) before the SDK call, settles to actual
cost on success, and releases on failure.

## Public API

- `PublicAiBudgetExceededError` — thrown when budget is `0n` (before the
  router is touched) or a reservation returns `false`.
- `PublicAiDeps` — `dailyBudgetMicrounits` (extension beyond the plan's
  listed fields so the `0n` gate can run before `router.complete`),
  `now`, `reserve`, `release`, `settle`, `router: StructuredRouter`.
- `runner.complete(request /* Omit<AiCompletionRequest,"workspace"> */)` and
  `runner.completeStructured(request /* Omit<…,"workspace"> */)` — both pin
  `workspace = { workspaceId: "platform:public", keyMode: "platform",
  budget: null }`.

## Important Notes / NEVER Change

- **Callers MUST gate with captcha + a shared rate limiter first** — this
  runner only enforces the spend cap.
- **Public AI never writes `ai_usage`** (workspace-FK-scoped); spend lives in
  `platform_ai_spend`, usage belongs to observability.
- `estimatedUsage` is required (`TypeError`) — reservations are computed via
  `calculateModelCost(model.price, estimatedUsage).totalCostMicrounits`
  inside `beforeProviderAttempt`.
- Provider failover may release a failed attempt's reservation, but a successful
  completion incurs cost even if its text later fails schema validation.
- 2026-10-03 repair: run each structured completion through the same budgeted
  completion boundary. Settle every successful provider result before schema
  parsing or repair; a final `StructuredOutputError` must not erase its costs.
  Preserve the existing result shape and disabled-by-default policy.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Created (Task 6, feat/prod-ready-kit) | Devin |
