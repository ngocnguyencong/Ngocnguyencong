# MasterDetail

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

Copyable app block for a controlled master/detail layout with responsive
selection behavior.

## Public API

- `items`: readonly records with stable string `key` and visible `title`.
- `selectedKey` and `onSelectionChange`: controlled selection; pass `null` to
  clear the detail pane.
- `renderListItem` and `renderDetail`: caller slots that receive item data.
- `empty`, `loading`, `loadingState`, and `error`: caller-supplied states; an
  error takes precedence over loading and normal detail content.
- Accessible list/detail labels and a visible narrow-screen Back action.

## Important Notes

- The block owns only selection presentation. It performs no fetches and keeps
  no URL state.
- At viewport widths up to 44rem it shows the list before a valid selection,
  then the detail pane; Back clears the controlled selection. A stale key keeps
  the list visible. Wider layouts show both panes.
- Narrow selection moves focus to Back (or the detail region); Back restores
  focus to the previously selected list button. Wide layouts preserve focus on
  the clicked list button.
- Source and CSS stay self-contained and token-only.

## Validation

- jsdom regressions cover callback keys, controlled detail rendering, supplied
  empty/loading/error states, stale selection, mobile focus transfer and
  restoration, and wide-layout focus preservation.
