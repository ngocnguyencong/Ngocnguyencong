# packages/design-tokens/src/index.ts

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

Exports shared semantic design-token references used by the web and mobile
theme systems.

## Exports / Integration

Exports `motionTokens` (120/180/120/220/160 ms), `semanticStatusColors`, and
`mobilePalettes` with explicit label/control-border roles. The existing
`referenceTokens` API remains compatible.

## Open Threads / Resume Context

- **Status:** implemented locally
- **Intent:** expose reusable cross-platform motion and status token values.

## Important Notes / NEVER Change

- Keep values framework-neutral and safe to import from web and mobile code.
- Do not rename or remove `referenceTokens`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-06 | Add shared motion, status, and additive mobile token exports | Codex |
