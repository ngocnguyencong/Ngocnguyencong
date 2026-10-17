# mobile-shell.spec.ts

Two local Chromium browser fixtures pass: 320/390/760px and short landscape navigation across sidebar/topnav/focused/collapsible preferences; scrolling to footer/account actions, nested popover Escape, focus restoration, scroll lock, resize reset, desktop rail and no-JS navigation. Session/workspace reads mocked and writes blocked. No real account/provider mutations. Can run against local server with an ignored bounded config to avoid unrelated global setup.
