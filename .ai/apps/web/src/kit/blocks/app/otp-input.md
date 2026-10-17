# apps/web/src/kit/blocks/app/otp-input.tsx + otp-input.module.css

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

`OtpInput` kit block — a one-time-code field on the **single-hidden-input**
pattern (hand-rolled `input-otp`, no dependency): one real `<input>` lies
invisible (`position:absolute; inset:0; opacity:0`, transparent text/caret,
`font-size:16px` against iOS zoom) over `length` per-digit `<span>` boxes, so
paste, iOS `autoComplete="one-time-code"` SMS autofill, selection, and screen
readers stay native while slots are pure visuals (`aria-hidden`). Registered in
`KIT_BLOCKS`, surface `app`; powers the `/auth` otp-verify step.

## Important Notes / NEVER Change

- Input renders LAST in DOM order inside the `position:relative` root — it
  paints over the slots and receives every click; never reorder.
- Controlled OR uncontrolled: effective value `value ?? internal`; `value`
  without `onChange` renders `readOnly` (no React warning, honest semantics).
- `sanitizeOtp` (`/\D/g` strip + slice) runs in `onChange` so pasted
  "123-456" cleans; `onComplete` fires when `next.length === length &&
  next !== current` (early-return above guarantees the diff).
- **Append-only caret model** (2026-09-23 review fix): the invisible
  input's 16px text occupies ~53px while slots span ~276px (6 slots ×
  ~37.7px from `min-height:44px` × `aspect-ratio:6/7`, + 5×8px gaps +
  10px dash), so mid-row clicks land `selectionStart` semi-arbitrarily —
  a mid-string insert would shift digits and could auto-submit a
  corrupted complete code. `clampCaret(el, pos)` snaps the selection to
  the end on `onFocus`/`onClick`/`onSelect` (arrows/Home get clamped back
  via the select event) and to `next.length` inside `handleChange` (the
  trailing select event does NOT fire on React's programmatic value
  write). The interaction handlers derive the clamp target from the
  element's sanitized value (`sanitizeOtp(el.value, length).length`), not
  the render closure — a between-commit event can't clamp to a stale
  length. The inequality guard prevents selectionchange →
  setSelectionRange loops. `activeIndex = Math.min(current.length,
  length - 1)` — no caret state.
- Display value is sanitized too (`sanitizeOtp(value ?? internal, length)`)
  — a parent passing "123-456" renders 6 clean digits.
- `name` passthrough enables native form serialization; `ref` forwards to
  the real `<input>` (React 19 — no forwardRef). Slots carry
  `data-otp-slot`, the mid-dash `data-otp-separator` — stable test hooks.
- Accent ring + blink caret only while `focused`, caret bar only in an
  EMPTY active slot.
- Dash separator between halves only for even `length >= 4` (before index
  `length/2`). `type="text"` (never `number`), `inputMode="numeric"`.
  Deliberately NO `maxLength` — the browser would truncate a pasted
  "123-456" to "123-45" before `onChange`, so `sanitizeOtp` (which slices
  to `length` anyway) is the only length gate.
- Tokens only; `.root[data-disabled] .slots` dims via attribute presence —
  `data-disabled={disabled || undefined}` must keep the `|| undefined`
  (React emits `data-*="false"` for literal `false`, which would still match).
- Mobile keyboard hygiene on the real input: `autoCapitalize="none"`,
  `autoCorrect="off"`, `spellCheck={false}` — digit entry must never be
  "corrected" or capitalized.
- Test file is `otp-input.test.tsx` — `// @vitest-environment jsdom`
  pragma (jsdom is an `apps/web` devDependency); static-markup assertions
  plus a jsdom `createRoot`+`act` layer covering sanitize-on-change,
  `onComplete` timing/re-fire, and the caret clamp (click/focus/document
  `selectionchange` — a raw `select` dispatch does not reach React's
  onSelect in jsdom). vitest `include` was widened to `*.test.{ts,tsx}`
  (root + apps/web configs) to discover it; the oxc JSX transform keeps
  React prop casing in static markup (`inputMode`, not `inputmode`).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Clamp handlers derive the target from `sanitizeOtp(el.value, length).length` (was render-closure `current.length`); `autoCapitalize`/`autoCorrect`/`spellCheck` on the input; jsdom DOM test layer; ~276px slot-width comment confirmed (was ~340px here) | Devin |
| 2026-09-23 | Append-only caret model (clampCaret on focus/click/select/change, caret state removed); `ref` + `name` props; display value sanitized; `data-otp-separator` hook; `.root` hugs slots (`fit-content`), slot min-height reads `--button-min-height` | Devin |
| 2026-09-23 | Dropped `maxLength` (truncates pasted separators pre-sanitize); `autoComplete?: string \| undefined` for exactOptionalPropertyTypes | Devin |
| 2026-09-23 | Created — hidden-input OTP block for the /auth verify step | Devin |
