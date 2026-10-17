# packages/ai/package.json

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

`@supastack/ai` package manifest — provider-neutral model routing, pricing,
provider adapters, key vault, structured completions. Source-only workspace
package (`exports` → `./src/index.ts`); `typecheck`/`test`/`build` scripts.

## Important Notes

- `zod` (`catalog:`) added 2026-09-23 for `structured.ts` (`ZodType` +
  `z.toJSONSchema`).
- AI SDK deps (`ai`, `@ai-sdk/*`) are pinned versions, not catalog.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-03 | `license` field added (`SEE LICENSE IN LICENSE.md`) | Devin |
| 2026-09-23 | +`zod` dependency (Task 5, feat/prod-ready-kit) | Devin |
