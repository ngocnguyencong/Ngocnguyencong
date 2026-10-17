# packages/agents/src/adapters/

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Four framework adapters, each exposing `create*Runner(model: AgentModelSource): AgentRunner`
and routing every tool call through `executeToolCall`:

- `ai-sdk.ts` — `generateText` + `tool({description, inputSchema: zodSchema,
  execute})`, `stopWhen: stepCountIs(maxSteps)`, `abortSignal`.
- `mastra.ts` — `@mastra/core` `Agent` + `createTool`; AI SDK model passed via a
  narrow compat cast (Mastra's `MastraModelConfig` declaration doesn't accept
  the ai@7 `LanguageModel` union directly). `agent.generate(prompt, { maxSteps })`.
- `langgraph.ts` — `StateGraph`/`ToolNode`/`toolsCondition` ReAct loop with
  `@langchain/core` `tool()` wrappers; model from `model.langChainModel()`
  (throws a clear error when absent); `recursionLimit` from maxSteps.
- `openai-agents.ts` — `@openai/agents` `Agent`/`tool`/`run` with
  `model: aisdk(languageModel)` from `@openai/agents-extensions/ai-sdk`;
  `maxTurns: maxSteps`; tracing disabled (`setTracingDisabled(true)`) so
  nothing phones home to OpenAI.

## Important Notes / NEVER Change

- Compatibility casts live only at the framework boundary (declaration
  mismatches among ai@7, Mastra, and agents-extensions under
  `exactOptionalPropertyTypes`); keep them narrow and local.
- Tool `workspaceId`/`userId` always come from `ToolContext`, never model
  input — enforced inside `executeToolCall`.
- Shared offline contract test in `src/adapters.test.ts` runs the same
  scripted tool-call turn through all four adapters.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | All four adapters implemented, 20 tests green | Devin |
