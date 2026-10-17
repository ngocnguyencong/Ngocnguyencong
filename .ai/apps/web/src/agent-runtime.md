# apps/web/src/agent-runtime.ts

> Last updated: 2026-10-03 | Protection: STANDARD

## Purpose

Server-only composition for agent runs. `createLanguageModel(aiConfig,
modelId)` builds an `AgentModelSource`: AI SDK model for
openai/anthropic/openai-compatible/openrouter (fake → throws "Agents need a
real AI_PROVIDER"), plus `langChainModel` (`@langchain/openai` `ChatOpenAI`)
for openai/openai-compatible/openrouter (OpenRouter →
`https://openrouter.ai/api/v1` + X-Title/HTTP-Referer attribution);
`undefined` for anthropic. `createWorkspaceAgentRunner(serverConfig, modelId)`
dispatches on `serverConfig.agents.framework` (`AGENT_FRAMEWORK`).

## Important Notes / NEVER Change

- No public endpoint for agent runs — they would bypass the ModelRouter
  budget enforced on AI task aliases. Server-side composition only. The
  supported caller path is `runBudgetedAgent` (`agent-budget.ts`) via
  `getAgentRunRuntime()` (`ai-task-runtime.ts`), which reserves the
  maxSteps-scaled estimate before this factory's adapter ever runs.
- Attribution headers mirror `server-provider-composition.ts`:
  `OPENROUTER_APP_NAME` → `X-Title`, `OPENROUTER_SITE_URL` → `HTTP-Referer`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-03 | Now composed by `getAgentRunRuntime().runAgent` as the `createRunner` dep of the budgeted agent-run path | Devin |
| 2026-09-23 | Created; 5 offline provider-selection tests | Devin |
