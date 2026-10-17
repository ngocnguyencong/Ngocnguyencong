# Shared UI primitives

Select, Popover, Dialog, Sheet, Tabs, and Disclosure are client components using native form/disclosure/dialog semantics. Select is a single-choice enhanced native select: option children, name, defaultValue/value, disabled/required, and onChange remain native; reset, labels, invalid focus, disabled options, and scrolling active choices work. Menus close with Escape and outside pointers. Nested Escape closes only the active overlay. Dialog/Sheet contain focus, lock background scrolling, and restore the opener. Popover restores focus for in-panel keyboard closure while preserving outside-pointer focus. Tabs use roving tab stops; disclosures remain native details without JavaScript.

Motion uses shared package timings and root tokens. Exiting surfaces remain mounted until completion; reopening cancels pending removal. CSS transitions use named properties, hover is touch-gated, and reduced motion retains static state cues. No workspace data or provider access belongs here.

Tests cover native form serialization/reset, disabled selection, option scrolling, modal focus containment, nested dismissal, action focus return, interrupted exits, tabs, and native disclosure content. No open implementation work.

Focus-stop discovery is shared by initial focus and Tab wrapping. Exclude descendant dialogs, hidden/inert/aria-hidden subtrees, CSS-hidden controls, and inherited disabled fields before choosing any target.
