# resources.spec.ts

## Purpose

Browser acceptance for public blog/docs navigation, search, 404s, anchors, mobile/no-JS reading and disclosure behavior.

The mobile overview navigation follows the current adjacent-guide link to
`/docs/mobile/local-setup`, checking its href, resulting URL and five-minute
setup title. The older "Continue setup" footer label no longer exists; search,
empty-state and remaining navigation assertions stay in the same test.

## Open Threads

- Extend coverage for complete docs navigation, new overview, search dialog keyboard/focus and narrow screens; keep existing reading regressions.
