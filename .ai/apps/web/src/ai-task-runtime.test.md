# apps/web/src/ai-task-runtime.test.ts

> Last updated: 2026-10-03 | Protection: STANDARD

## Purpose

Unit coverage for `ai-task-runtime.ts` — the
`resolveWorkspaceAiContext` monthly-spend window, the
`executeTriggeredAiTask` observability contract, and the
`getAgentRunRuntime` production wiring.

## Coverage

- `getAgentRunRuntime` wiring — `runBudgetedAgent` is a `vi.fn` that
  captures the injected deps: `findModel` asserts `eq(aiModel.id, modelId)`
  (catalog-id resolution, never a positional fallback), `createRunner`
  asserts the provider model name is forwarded to the lazily imported
  `createWorkspaceAgentRunner(serverConfig, …)` (`./agent-runtime` is
  mocked so the dynamic `import()` resolves to the spy), and the caller's
  shared `tools` array passes through by reference.

- `executeTriggeredAiTask` — `correlationId` from the parsed payload is
  threaded into `ai_task_completed` properties and the
  `measure("ai.task.execute")` context; a payload without one gets a
  freshly minted `corr_` id (never fails); executor rejection funnels the
  id into `captureException` context and rethrows `AiTaskExecutionError`.
- Executor completion wiring — `createProductionAiTaskExecutor` captures
  its deps at module load (`executorDeps.current`), so the composed
  `onTaskCompleted` is invoked directly: the input `correlationId` lands
  on the `ai.task_completed` `tryEmitWorkspaceEvent` call (and is omitted
  when absent).

- `resolveWorkspaceAiContext` — asserts the `ai_usage` sum is bounded
  `gte(createdAt, monthStart) AND lt(createdAt, nextMonthStart)` (the same
  `[periodStart, nextPeriodStart)` window `authorizeAiProviderAttempt`
  uses), that `ai_budget_reservation` holds stay keyed by exact
  `periodStart` + `status='reserved'`, and that
  `spentMicrounits` = spend + held. Dates are pinned with fake timers.

## Mocks

- The seam is `getChatStreamRuntime().completeChat`: `completeBudgetedChat`
  is a `vi.fn`, so the injected `resolveWorkspaceAiContext` is captured
  from `mock.calls` and invoked directly.
- `./auth-runtime` `database` — the same drizzle chain duck as
  `webhook-delivery.test.ts` (thenable `where()` + `.limit()`, pops
  `selectResults`).
- `@supastack/config` `parseServerConfig` returns a local-mode stub
  (`jobs.kind: "local"`, so the BFF/Trigger path never initializes);
  `@supastack/jobs`, `@trigger.dev/sdk`, the catalog/BFF/executor/BYOK/
  composition/observability/rate-limit modules are all stubbed — the file
  is a composition root with module-level wiring.
- `./ai-task-executor` — `createProductionAiTaskExecutor` returns a shared
  hoisted `run` spy (`executorRun`) so the runtime tests can resolve/reject
  it, and captures the real deps object into `executorDeps.current` so
  `onTaskCompleted` can be invoked directly;
  `parseTriggeredAiTaskPayload` is a `vi.fn` driven via
  `vi.mocked(...).mockReturnValue`.
- `./webhook-delivery` — `tryEmitWorkspaceEvent` stubbed as a hoisted
  `emitWorkspaceEvent` spy for the completion-wiring assertions.
- `./observability-runtime` — `serverObservability.{track,captureException}`
  spies plus `measure` invoking its `fn` straight through (duration
  emission is pinned by observability-runtime's own tests).
- `drizzle-orm` — `eq`/`gte`/`lt` wrapped in `vi.fn` call-through for
  argument assertions; `@supastack/db` imports are real (table columns +
  `effectiveAiMonthlyBudget`).

## Open Threads / Resume Context

- Guest write context is rejected before entitlement lookup; an entitled member context succeeds. The month-window test remains.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-03 | `getAgentRunRuntime wiring` describe: `findModel` `eq(aiModel.id)` pin, lazy `createRunner` forward, tools pass-through; `./agent-budget` + `./agent-runtime` mocked | Devin |
| 2026-09-29 | `executor completion wiring` describe: deps captured at composition, `correlationId` → `tryEmitWorkspaceEvent` assert; `./webhook-delivery` mocked | Devin |
| 2026-09-29 | `executeTriggeredAiTask` correlation coverage; executor/observability mocks restructured (hoisted `run` spy, `measure` pass-through) | Devin |
| 2026-09-27 | Initial — pins the symmetric month-window bound on the advisory spend sum | Devin |

Release verification: remove the unused destructured correlation variable while preserving the legacy-payload omission regression.
