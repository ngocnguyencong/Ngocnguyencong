# Pagination tests

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

jsdom interaction regressions for controlled pagination.

## Coverage

- Previous and next call the controlled callback with adjacent bounded pages.
- First/last/no-pages states disable the correct native buttons.
- Actions expose supplied accessible names and page status reflects the
  controlled props.
- The block never emits out-of-range page numbers.
- The optional disabled state blocks both controls and does not call the
  callback.

## Validation

- The focused suite passed after the tests first failed against the missing
  component implementation.
