# apps/web/src/agent-budget.ts

> Last updated: 2026-10-03 | Protection: STANDARD

## Purpose

Server-only budgeted agent runs — the ModelRouter-budget path that keeps
`createWorkspaceAgentRunner` usable without a public endpoint.
`runBudgetedAgent(input, dependencies)` resolves the workspace AI context,
loads the enabled catalog model + price via `findModel`, records an
`agent.run` task row, reserves the `maxSteps`-scaled
`estimateConservativeUsage` cost through `authorizeAiProviderAttempt`, runs
the injected `AgentRunner` with the caller's `ToolContext`
(`workspaceId`/`userId`/`scopes` — never model-derived) and tools filtered
to those scopes, appends actual usage to `ai_usage`, settles the hold at
real cost, and persists the result on the task row.

## Important Notes / NEVER Change

- `recordTaskRun` runs before `authorizeAiProviderAttempt` — the
  reservation transaction requires an owned `task_run` row.
- `keyMode === "byok"` → `AgentByokUnsupportedError` before the task row:
  BYOK workspaces authorize hold-free but `createWorkspaceAgentRunner`
  bills the platform key — rejected until agent runtimes resolve
  per-workspace provider keys.
- Tool-scoped runs against a catalog model with `capabilities.tools === false`
  → `AgentModelCapabilityError` before the task row.
- `budget_exceeded` → `WorkspaceBudgetExceededError`; `entitlement_required`
  and other non-authorized statuses → `AiProviderAttemptAuthorizationError`;
  the runner is never created on denial. `reservationId` may return null
  (authorized with no hold when the effective budget is unlimited) —
  settle is then skipped.
- The estimate multiplies input+output token counts by `maxSteps`
  (bigint-safe, default `DEFAULT_AGENT_MAX_STEPS`); a non-positive/non-integer
  `maxSteps` throws before any workspace work so a zeroed estimate can never
  produce a zero-cost reservation.
- When the adapter reports no `result.usage`, the hold settles at the full
  estimate (conservative — the run happened) while the usage row records
  zeroed token counters.
- On failure the hold releases at 0n unless the run already finished (its
  provider cost may be real even if usage persistence failed, so the hold
  stays reserved — chat-budget semantics); `markTaskRunFailed` is
  best-effort and the typed error rethrows.
- Unknown `modelId` → `AgentModelNotFoundError` before `recordTaskRun`;
  mismatched resolved `workspaceId` → rejected before the task row exists.
- `modelId` input is the catalog `ai_model.id`; `createRunner` receives the
  provider model name (`AvailableModel.model`). The estimate includes
  instruction bytes, scaled by `maxSteps`; `scopes` is caller-authorized and
  copied defensively into the frozen `ToolContext`. The persisted result
  carries `{model, source, text, toolCallCount, toolNames}` for audit.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-03 | Review fixes: BYOK reject, tools-capability gate, instructions in estimate, scoped-copy + audit payload, AiProviderAttemptAuthorizationError reuse | Devin |
| 2026-10-03 | Created: budgeted agent-run helper mirroring `chat-budget.ts` | Devin |
