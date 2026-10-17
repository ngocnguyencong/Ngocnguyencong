# tests/e2e/resources.spec.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Chromium coverage for the public resources surface: blog nav/category
filter/article→docs links, docs tabs + search + empty state + adjacent
guides, no-JavaScript reading/search/header nav, 404s, tablet-width cards
+ shared control radius, and the `/faq` disclosure behavior.

## Important Notes

- Search submit is `getByRole("button", { name: "Search", exact: true })` —
  the palette trigger ("Search ⌘K"/"Ctrl K") would collide without `exact`.
- The old homepage `#architecture` scroll-story + `[data-story-progress]`
  assertions were REMOVED 2026-09-22 — the section was intentionally
  deleted from the product in 5b7f058; the FAQ test now only covers the
  disclosure behavior. Do not re-add story selectors unless the section
  returns.
- Client-side docs nav (RSC render) can be slow on `next dev` under load —
  rely on the global 15s expect timeout rather than per-call overrides.
- The pre-hydration disclosure tests hold `**/*.js*` requests
  (`clickSummaryBeforeHydration` — the trailing `*` also catches
  query-suffixed dev chunks) so a native `<summary>` click lands before
  React's attribute diff — deterministic reproduction of the `open`
  hydration-mismatch race. The helper self-verifies the click landed
  pre-hydration by clicking the palette trigger and asserting the dialog
  stays closed (React `onClick` can't have run), inside a `try/finally`
  that always releases held routes. `waitForHydration` proves hydration
  ran by opening the `Search Ctrl K`/`⌘K` palette (only works via React
  `onClick`) — the form's Search button shares the role name, hence the
  longer regex.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Hardened held-JS helper: `**/*.js*` glob (query-suffixed chunks), palette-dialog probe proves click landed pre-hydration, `try/finally` release | Devin |
| 2026-09-23 | Pre-hydration `<details>` toggle regression tests (held-JS + native summary click) for the `open` hydration-mismatch fix | Devin |
| 2026-09-22 | exact:true Search buttons; article-visibility assert; removed stale #architecture story half of FAQ test | Devin |
