# MasterDetail tests

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

jsdom interaction regressions for controlled selection and state rendering.

## Coverage

- Clicking an item calls `onSelectionChange` with its stable key.
- A selected item renders its detail slot; an unknown or null key renders the
  empty state and does not switch the narrow layout away from the list.
- Loading/error states take precedence over normal content and are exposed
  with useful semantics.
- The visible Back button calls `onSelectionChange(null)` and has its supplied
  accessible label. Under a mocked narrow media query, focus moves to Back on
  selection and returns to the same list button on Back; wide mode preserves
  list-button focus.

## Validation

- The focused suite passed after the tests first failed against missing
  component implementations.
