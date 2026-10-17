# src/kit/blocks/marketing/scroll-end-cta.test.tsx

jsdom + fake-timer tests for the block. `showModal`/`close` are shimmed on
`HTMLDialogElement.prototype` (jsdom lacks implementations); `scrollTo()`
stubs `scrollHeight`/`innerHeight`/`scrollY` and dispatches a `scroll`
event. Cases: bottom-reach opens once per session (reload doesn't repeat),
dwell fallback at `delayMs`, no fire on viewport-height pages, visible-time
accounting, Tab/Shift+Tab boundaries, other-dialog/form-focus deferral,
storage-unavailable behavior, unmount cleanup, and `preview` inline render.
`matchMedia` is stubbed to `matches: true` (reduced motion) so `close()`
takes the instant path.
