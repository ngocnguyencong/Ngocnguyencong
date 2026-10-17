# TableToolbar styles

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

Token-only responsive styles for the controlled table toolbar.

## Important Notes

- Search, filter controls, result count, and actions form a readable responsive
  flow; controls remain distinguishable and keyboard focus remains visible.
- Use logical properties and no raw color values or private component imports.

- `disabled` preserves native disabled semantics for the built-in search and
  clear controls; callers can disable arbitrary child controls in their own
  fieldset or control props.

## Validation

- The stylesheet uses theme tokens, logical properties, 44px controls, visible
  focus, and reduced-motion-safe feedback.
