# TableToolbar tests

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

jsdom interaction regressions for the controlled table toolbar.

## Coverage

- Search input has its visible accessible label, renders the controlled value,
  and reports edits through `onSearchChange`.
- Result count uses the supplied count/copy.
- Caller filter/action children render, and clear filters calls the supplied
  callback with correct enabled/disabled behavior.
- The optional `disabled` prop disables the built-in search and clear controls.

## Validation

- The focused suite passed after the tests first failed against the missing
  component implementation.
