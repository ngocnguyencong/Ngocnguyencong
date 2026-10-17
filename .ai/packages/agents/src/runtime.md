# packages/agents/src/runtime.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Runner contract: `AGENT_FRAMEWORKS` (`ai-sdk|mastra|langgraph|openai-agents`),
`AgentRunInput` (instructions/prompt/tools/context/maxSteps default 8/signal),
`AgentRunResult` (framework/text/toolCalls/usage), `AgentModelSource`
(AI SDK `LanguageModel` + optional `langChainModel()` for langgraph),
`createAgentRunner` — dynamic `import()` per adapter so unused framework SDKs
never enter the module graph.

Relative lazy imports use extensionless paths, consistent with the package barrel and Bundler module resolution. This lets the Web build resolve TypeScript source exports while keeping adapter selection lazy.

## Important Notes / NEVER Change

- `config.AGENT_FRAMEWORK` accepts the same four values; default `ai-sdk`.
- `langChainModel` is required only by the langgraph adapter; web composition
  supplies `ChatOpenAI` for openai/openai-compatible/openrouter, none for
  anthropic.
- The private package exports TypeScript source. Keep lazy adapter paths
  extensionless so the web bundler resolves those source files; a `.js` dynamic
  import searches for a file that does not exist in the source package.

## Open Threads / Resume Context

- Correct the source adapter import paths after the production build reproduced
  four unresolved `.js` imports, then rerun all four adapter tests and the build.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Created contract + lazy adapter dispatch | Devin |
