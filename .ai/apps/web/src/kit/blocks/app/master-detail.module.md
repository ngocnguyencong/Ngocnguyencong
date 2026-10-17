# MasterDetail styles

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

Token-only responsive styling for `MasterDetail`.

## Important Notes

- A 44rem media query switches from both panes to the list first, then the
  detail pane only for a valid selected item or supplied loading/error state.
- The Back control is visible and in normal reading order in the narrow detail
  view; stale selection cannot hide the list without an exit action.
- Use logical properties and preserve visible focus, reduced-motion behavior,
  and the surrounding theme tokens.
- Do not add private UI imports or raw color literals.

## Validation

- CSS uses the viewport breakpoint and `data-selected` state; color, border,
  radius, focus, and motion values come from theme tokens.
