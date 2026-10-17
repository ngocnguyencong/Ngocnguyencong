# src/kit/blocks/app/tooltip.tsx + tooltip.module.css

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Kit block — `<Tooltip content side? delayMs? as?>{children}</Tooltip>`,
a client component rendering a delayed hover / instant keyboard-focus
bubble.

## What It Does

- Relatively positioned wrapper (`span` default, `as="div"` around block
  cards) holding children + a persistent `role="tooltip"` bubble with a
  `useId` id; the bubble stays in the DOM so `aria-describedby` resolves.
- Effect sets `aria-describedby` on the first focusable descendant, else
  on the wrapper (which then gains `tabIndex=0`).
- Opens after `delayMs` (300 default) on `pointerenter` for mouse/pen
  only — touch never opens; opens immediately on any focus (APG pattern —
  keyboard `focus-visible` included); closes on `pointerleave`, blur,
  Escape.
- Bubble: centered above (or below for `side="bottom"`), `max-width:260px`,
  12px/1.45, `--raised` + `--border` hairline, `--radius-control`, subtle
  shadow, 6px rotated-square caret, `pointer-events:none`, `z-index:50`;
  fade + 4px rise, opacity-only under reduced motion.

## Important Notes / NEVER Change

- Touch pointers must never open the bubble.
- Keep the wrapper outside `overflow:hidden` ancestors of the trigger.

## Change History

| Date | Change | Author |
| ---- | ------ | ------ |
| 2026-09-23 | New app block; registered in KIT_BLOCKS + `/kit-blocks` demo | Devin |
