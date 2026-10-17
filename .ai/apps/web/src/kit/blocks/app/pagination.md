# Pagination

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

Copyable controlled pagination with bounded previous/next actions.

## Public API

- `currentPage`, `pageCount`, and `onPageChange` stay caller-controlled.
- Navigation, previous, next, and page-status labels are supplied or formatted
  by the caller so the control remains localizable.
- Native disabled buttons represent both bounds and the no-pages state.
- Optional `disabled` disables both actions and prevents callbacks.

## Important Notes

- The block never fetches records or reads/writes URL state.
- Click handlers cannot emit a page below one or above `pageCount`.
- All CSS uses project tokens and keeps focus visible.

## Validation

- jsdom tests cover accessible action names, bounded callbacks, first/last/no
  page states, controlled status, and the optional disabled state.
