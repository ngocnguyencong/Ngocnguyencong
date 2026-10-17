# packages/agents/src/index.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Barrel: re-exports `tools`, `execution`, `runtime`. Adapters are intentionally
NOT re-exported — they load lazily via `createAgentRunner`'s dynamic imports
so unused framework SDKs stay out of consumer bundles.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Created | Devin |
