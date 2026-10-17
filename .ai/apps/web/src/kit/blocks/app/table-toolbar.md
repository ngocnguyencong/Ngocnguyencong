# TableToolbar

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

Copyable app toolbar for controlled search, result count, filters, and actions.

## Public API

- Controlled `search` / `onSearchChange` and a required visible `searchLabel`.
- A controlled result count with caller-supplied count copy.
- Arbitrary `children` for filter and action controls.
- A caller-labeled clear-filters action with optional disabled state.
- Optional `disabled` applies to the search input and clear action.

## Important Notes

- Search stays in the caller; this block does not filter or fetch records.
- Every interactive element uses native input/button semantics and visible
  labels. CSS remains token-only and self-contained.

## Validation

- jsdom tests cover visible labeling, controlled search/count, child slots,
  clear action behavior, and disabled built-in controls.
