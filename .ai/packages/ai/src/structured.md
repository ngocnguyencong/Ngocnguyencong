# packages/ai/src/structured.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

`completeStructured(router, request, hooks?)` — schema-checked JSON
completions. Composes a prompt embedding `z.toJSONSchema(schema)` + a
"single JSON object only" instruction, calls `router.complete` with
`input: { prompt }` and `requirements` merged with `structuredOutput: true`,
extracts the JSON (raw text, ```json fence, or outermost `{…}` span), and
`safeParse`s it. One repair retry re-prompts with the zod issue summary +
previous raw output truncated to 2,000 chars.

## Public API

- `StructuredRouter` — `{ complete(AiCompletionRequest, hooks?) }` subset of
  `ModelRouter`.
- `StructuredCompletionRequest<T>` — `AiCompletionRequest` minus
  `input`/`requirements`, plus `prompt`, `schema`, `schemaName`,
  optional `requirements`, `maxAttempts: 1|2` (default 2).
- `StructuredCompletion<T>` — `{ value, result, attempts }`.
- `StructuredOutputError` — `.issues` (zod issue strings), `.attempts`;
  `.message` never contains raw model output.

## Dependencies

- `zod` (added to package deps — `catalog:` 4.5.4) for `ZodType` /
  `toJSONSchema`.
- `./contracts` types only — no router/provider imports.

## Important Notes / NEVER Change

- The router input shape is `{ prompt }` — every `SdkAiProvider` forwards
  `request.input` verbatim to the SDK client and `ai-task-executor` uses the
  same shape; do not send messages arrays or provider-specific payloads.
- `structuredOutput: true` is always merged into forwarded `requirements` so
  the router filters to structured-capable models.
- Repair prompt may embed truncated raw output; the thrown
  `StructuredOutputError.message` must never contain it.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Created (Task 5, feat/prod-ready-kit) | Devin |
