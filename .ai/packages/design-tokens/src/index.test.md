# packages/design-tokens/src/index.test.ts

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

Checks the shared design-token package's stable public values.

## Coverage

- Existing `referenceTokens` shape and values remain compatible.
- Shared motion durations expose feedback, enter, exit, disclosure-open, and
  disclosure-close values in milliseconds.
- Light and dark status palettes expose success, warning, danger, and info.
- Mobile palette aliases resolve to their intended existing palette values.

## Open Threads / Resume Context

- **Status:** implemented locally
- **Intent:** add behavior-first tests before changing token exports.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-06 | Add contract coverage for additive shared token exports | Codex |
