# packages/ai/src/structured.test.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

`completeStructured` unit tests against a stub `StructuredRouter` returning
queued texts and capturing requests/hooks: typed happy path, fenced/prose
JSON extraction, repair retry (issue summary + 2,000-char raw truncation),
`StructuredOutputError` on double failure (no raw output in `.message`),
`maxAttempts: 1`, `structuredOutput: true` requirements merge + hooks
forwarding, prompt contents (schema JSON + single-object instruction).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Created (Task 5, feat/prod-ready-kit) | Devin |
