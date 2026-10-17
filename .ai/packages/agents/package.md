# packages/agents/package.json

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

`@supastack/agents` — framework-neutral agent layer. Tool contract + registry,
shared execution wrapper, runner contract, and four adapters (Vercel AI SDK,
Mastra, LangGraph.js, OpenAI Agents SDK). Exported via `./src/index.ts` like
`@supastack/ai`.

## Important Notes / NEVER Change

- `zod` uses the catalog version; `ai` pinned to the repo's `7.0.92`.
- Framework SDKs are dependencies here so adapters can import them; the
  runtime lazy-imports each adapter so unused frameworks never load.
- Consumed by `apps/web` (`agent-runtime.ts`, `workspace-tools.ts`,
  `mcp-server.ts`) via `workspace:*` — keeps the package inside the
  supastack-web sub-repo dependency closure.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-03 | `license` field added (`SEE LICENSE IN LICENSE.md`) | Devin |
| 2026-09-23 | Package created with pinned framework SDK deps | Devin |
