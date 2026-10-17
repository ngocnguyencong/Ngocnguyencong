# src/theme/appearance-sync.test.tsx

> Last updated: 2026-10-15 | Protection: STANDARD

## Purpose

jsdom decision tests for `AppearanceSync` (`// @vitest-environment jsdom`,
`createRoot` + `act`, fetch stubbed): server-newer applies the snapshot and
stamps `updatedAt` without a PUT; local-newer pushes the DOM snapshot;
`supastack:appearance-change` debounces into a single PUT; a rejected
fetch stays silent.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-15 | Created (4 tests) | Devin |
