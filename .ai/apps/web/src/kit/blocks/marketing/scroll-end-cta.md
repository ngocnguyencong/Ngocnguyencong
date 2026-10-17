# src/kit/blocks/marketing/scroll-end-cta.tsx

## Purpose

Copyable marketing block: a once-per-session follow-up dialog for visitors
who reach the end of a page. Generic version of the "still exploring?"
pattern — caller supplies `title`, `body` (ReactNode), a `primary` action
and an optional `secondary` action; no copy or destinations are built in.

## Behavior contract

- Two intent triggers share one guarded `check()`: a passive `scroll`
  listener fires when `scrollY + innerHeight >= documentElement.scrollHeight
  - 8` (requires `scrollY > 0`, so pages that fit the viewport never fire on
  mount), and a dwell timer fires after `delayMs` of *visible* time
  (default 90_000 — `visibilitychange` pauses/resumes the countdown).
- `check()` defers in 1s loops while another `dialog[open]`/`[role=dialog]`
  exists or `document.activeElement` sits in `form/input/textarea/select/
  [contenteditable]`; `document.hidden` and the `shown` flag short-circuit.
- Once per session: `sessionStorage` `storageKey` (default
  `"scroll-end-cta.shown"`) records the display; storage-disabled browsers
  still show once per mount.
- Native `<dialog>` + `showModal()`: backdrop click, Escape (`onCancel`), and
  the X button close through `close()` — 180ms `data-closing` exit,
  instant under reduced motion. `onClose` and unmount cleanup restore
  `body.style.overflow`. Tab/Shift+Tab cycle `a[href], button:not([disabled])`.
- `preview` renders the `.panel` inline (no dialog/listeners) for
  `/kit-blocks` and docs.
- Structural `lucide-react` imports (MessageCircle, X, ArrowUpRight) — the
  documented deviation shared with the minimal set.

## Verification

`scroll-end-cta.test.tsx` (jsdom + fake timers + showModal/close shims)
covers the scroll trigger, dwell fallback, custom delay, visible-time
accounting, once-per-session, deferral guards, Tab trap, storage failure,
unmount cleanup, and preview mode.
