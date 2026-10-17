# apps/web/src/ai-task-runtime.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Server-only composition root for AI task execution: binds
`createProductionAiTaskExecutor`/`createDrizzleRepositoryExecutor` to the
real tables (`aiModel`, `aiModelPrice`, `aiBudgetReservation`, `aiUsage`,
`entitlement`, `workspaceAiPolicy`, `workspaceMembership`, `user`).

## What It Does

- `getChatStreamRuntime()` exposes the router for public AI and a budgeted
  synchronous chat completion wired to the workspace repositories.
- `getAgentRunRuntime()` exposes `runAgent(input, tools)` — the budgeted
  agent-run path (`runBudgetedAgent` in `agent-budget.ts`) wired to
  `createWorkspaceAgentRunner`, the repositories, and
  `resolveWorkspaceAiContext`. The runner factory lazy-`import()`s
  `./agent-runtime` inside `createRunner` — a static import would pull the
  provider SDKs (Anthropic/OpenAI/LangChain/OpenRouter) into every
  ai-task-runtime consumer. Callers supply the shared workspace tools
  (`createWorkspaceTools({bff: apiV1Bff, headers: request.headers})`) so
  tool calls keep the caller's own REST authorization; the caller's
  `input.scopes` filter the set and pin `ToolContext` verbatim.
- `readCurrentModels(provider, now, modelId?)` gained the optional
  `modelId` filter (adds `eq(aiModel.id, modelId)`) so `findModel` can
  resolve one catalog row for a budgeted agent run; the router's
  unfiltered `readModels` call site is unchanged.
- Durable tasks write usage inside the executor. SSE chat uses
  `completeBudgetedChat` for pre-attempt reservation and strict usage
  persistence. `resolveWorkspaceAiContext` sums `ai_usage` rows and active
  holds into `spentMicrounits` for routing. The usage sum is bounded to
  `[monthStart, nextMonthStart)` — the same window
  `authorizeAiProviderAttempt` uses in `repositories.ts` — so a
  future-dated usage row can't inflate the advisory snapshot; holds stay
  keyed by `periodStart = monthStart` + `status='reserved'`.

## Important Notes

- `executeTriggeredAiTask` resolves the run's `correlationId` as
  `payload.correlationId` when valid, else `newCorrelationId()` (legacy
  envelopes mint at execution start — never fail over a missing id; a
  malformed value mints fresh rather than propagating) and threads it
  into the `ai_task_completed` event, the `ai.task.execute`
  `captureException` extra, and the
  `serverObservability.measure("ai.task.execute")` context (emits
  `ai.task.execute.duration` on success AND failure).
- `reportMetadataFailure` receives `correlationId` from the BFF and puts it
  in the `ai.task.attachRun` `captureException` context; the composition
  also wires `track` → `serverObservability.track` for `ai_task_submitted`.
- The executor's `onTaskCompleted` fan-out (`ai.task_completed`
  `tryEmitWorkspaceEvent`) forwards the task payload's `correlationId`, so
  the outgoing webhook delivery + terminal `webhook.delivery_failed` alert
  share the submitting request's id.
- Chat usage-write failures keep the winning budget hold reserved and return a
  safe SSE error; they cannot silently reset the budget.
- `findWorkspaceContext(userId, workspaceId?)` — when `workspaceId` is
  supplied (explicit `AiTaskCaller` from the /api/v1 BFF), the membership
  join is scoped `userId AND workspaceId`, proving membership in AND
  pinning the API key's workspace instead of taking the user's first
  membership; `completionEmailTo` still comes from that scoped row.

## Bug Fixes

| Date | Bug | Cause | Fix |
| --- | --- | --- | --- |
| 2026-09-27 | `sk_` API-key task calls used the wrong workspace context | `findWorkspaceContext` always resolved the user's first membership, ignoring the key's pinned workspace | Optional `workspaceId` param adds `eq(workspaceMembership.workspaceId, …)` to the membership lookup |

## Open Threads / Resume Context

- `findWorkspaceContext(..., "write")` rejects a guest before entitlement lookup or enqueue. Read contexts retain membership-scoped task visibility, and API-key workspace pinning remains intact.
- `findWorkspaceContext` selects `.limit(1)` with no ordering/active-workspace resolution when `workspaceId` is not supplied — the write gate now makes the first-returned membership's role decisive. Follow-up: deterministic ordering or active-workspace resolution.
- `normalizeWorkspaceRole` (`@supastack/db` `workspace.ts`, no mirror file) maps unknown roles to `"member"` — fails open for write checks. Follow-up: default to `"guest"` if a future role taxonomy lands.

## Change History


| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | `consumeTaskQuota` switched `resolveUsageLimit` → `resolveEffectiveUsageLimit` so an owner-set `workspace_usage_cap` engages the `ai.requests` consume even when no plan limit exists; the cap-bound rejection stays credit-free inside `consumeQuota` (WP2) | Devin |
| 2026-10-11 | `productionAiTaskBff` wires `consumeTaskQuota` → `consumeQuota({key: "ai.requests", n: 1, referenceId: taskId})`; an unresolved (unlimited) limit skips the consume so the seam stays dormant until a plan configures `usageLimits` | Devin |
| 2026-10-03 | `createRunner` lazy-imports `./agent-runtime` (provider SDKs stay out of unrelated module graphs) | Devin |
| 2026-10-03 | `getAgentRunRuntime()` + `readCurrentModels` optional `modelId` filter for the budgeted agent-run path | Devin |
| 2026-09-29 | `isCorrelationId` now imported from `@supastack/observability` (local copy removed) | Devin |
| 2026-09-29 | `onTaskCompleted` wiring forwards `correlationId` into the `ai.task_completed` workspace event | Devin |
| 2026-09-29 | Mint site validates via `isCorrelationId` — malformed payload ids mint fresh instead of propagating | Devin |
| 2026-09-29 | `executeTriggeredAiTask` threads `correlationId` (payload or freshly minted) into `ai_task_completed`, `captureException`, and a new `measure("ai.task.execute")` duration emit; BFF deps += `track`, `reportMetadataFailure` ctx += `correlationId` | Devin |
| 2026-09-27 | Open Threads += `findWorkspaceContext` first-membership decisiveness + `normalizeWorkspaceRole` fail-open notes | Devin |
| 2026-09-27 | Spend sum bounded `lt(aiUsage.createdAt, nextMonthStart)` to match the authorization window; `@supastack/db` named imports sorted alphabetically | Devin |
| 2026-09-27 | `findWorkspaceContext` gained optional workspace-scoped lookup | Devin |
| 2026-09-27 | `appendSyncAiUsage` merged via feat/prod-ready-kit — initial mirror | Devin |

## Security Fix (2026-09-27)

Production composition injects fail-closed user and workspace task limiters.
Workspace context applies the same effective monthly budget as DB authorization,
including the finite platform default. SSE chat uses the same router with
pre-attempt budget reservations and strict usage persistence.
