# packages/agents/src/*.test.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

- `tools.test.ts` (10) — registry: bad names, duplicate names, scope
  filtering, `get`.
- `execution.test.ts` (3) — scope refusal, zod validation, context injection.
- `adapters.test.ts` (7) — shared contract for all four frameworks: a scripted
  fake model calls `echo` with `{text:"hi"}` then answers "done: hi"; asserts
  `result.text`, `toolCalls`, and injected `ToolContext`. ai-sdk/mastra/
  openai-agents use `MockLanguageModelV*` from `ai/test`; langgraph uses a
  `FakeListChatModel`-style LangChain fake. Everything offline.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Written RED first (missing modules), then green | Devin |
