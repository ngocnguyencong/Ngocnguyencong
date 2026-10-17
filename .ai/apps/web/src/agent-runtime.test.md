# apps/web/src/agent-runtime.test.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Provider-selection tests (5): fake throws; openai/anthropic/openai-compatible/
openrouter build the right AI SDK model (`languageModel.provider` asserted via
a narrow cast — the ai@7 `LanguageModel` union doesn't expose `.provider` on
the base type); `langChainModel` present for openai/openai-compatible/
openrouter, absent for anthropic. Fully offline — constructors only.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Created | Devin |
