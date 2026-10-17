# tests/playwright-config.test.ts

> Last updated: 2026-10-09 | Protection: STANDARD

## Purpose

Guards the local browser runner against silently attaching to an unrelated server on its default port.

Coverage also checks both suites' bundled-browser default, explicit
channel override, warm-up, time budgets and the Windows single-worker
serial contract (platform-dependent `expect.timeout` included).

## Open Threads / Resume Context

- Complete. The test failed while server reuse was enabled and passed after disabling it. A different app on port 3100 had caused 14 false E2E failures; the local suite then passed 25/25 on a free port.
