# apps/web/src/observability-runtime.test.ts

> Last updated: 2026-09-29 | Protection: STANDARD

## Purpose

Unit coverage for `observability-runtime.ts` — the composition root is
loaded via dynamic `import("./observability-runtime.js")` after mocking
module boundaries; tests inject factories or stub `fetch`/`console`
globals to observe behavior offline.

## Mocks

- `server-only`, `@sentry/nextjs` (`init`/`captureException`),
  `posthog-node` (`PostHog` ctor) — all `vi.mock` stubs.
- `afterEach`: `vi.unstubAllGlobals()` + `vi.restoreAllMocks()`.

## Coverage

- Configured Sentry+PostHog → factories called with env values; `track`
  redacts `apiKey` in properties and injects `workspaceId`;
  `captureException` sanitizes the error (generic message, safe name, no
  secret-bearing stack/cause) and splits context into `extra`/`tags`;
  `shutdown` flushes PostHog.
- Unconfigured (`environment` only) → no provider factories called.
- `alert`: configured `alertWebhookUrl` → one `fetch` POST to the URL
  (`method`, `content-type: application/json`, `AbortSignal`, body
  `{text, name, severity, context}` with secrets `[REDACTED]`); no URL →
  `fetch` never called; rejected fetch and non-2xx each → swallowed,
  exactly one `console.warn` per send.
- `measure`: success → returns `fn`'s value and emits `<name>.duration`
  with `{durationMs, ...ctx props}` routed by ctx `distinctId`/
  `workspaceId`; thrown `fn` → original error rethrown AND duration still
  emitted with `"platform"` fallback scope; throwing analytics adapter →
  `fn`'s error identity and result preserved (emit can't mask);
  `{workspaceId:"ws-1"}`-only ctx → `distinctId` falls back to `"ws-1"`,
  no `distinctId` key in `properties`; ctx `durationMs:999` loses to the
  measured value.
- `logger.info` → one `console.log` line that `JSON.parse`s to
  `{level, message, timestamp, context}` with base
  `{environment, service:"supastack-web"}` merged and `apiKey` redacted.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-29 | `+=` throwing-adapter masking test (red→green for the finally try/catch fix), workspace-scope `distinctId` fallback pin, `durationMs`-wins pin (13 tests) | Devin |
| 2026-09-29 | `+=` alert/measure/logger cases (7 new tests; `Runtime` type extended; fetch/console global stubs + afterEach cleanup) | Devin |
