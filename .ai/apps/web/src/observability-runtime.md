# apps/web/src/observability-runtime.ts

> Last updated: 2026-09-29 | Protection: STANDARD

## Purpose

Server-only observability composition root. `createServerObservability
({config, factories})` wires PostHog (analytics), Sentry (errors), a
generic HTTPS alert webhook, and a structured stdout logger through the
vendor-neutral `@supastack/observability` contracts; the
`serverObservability` singleton is built from `parseServerConfig()`
(`{environment, ...config.observability}`) and frozen —
`{alert, captureException, logger, measure, shutdown, track}`. Every
surface noops when its env is unset.

## What It Does

- `track`/`captureException` — `createObservability` over PostHog +
  Sentry adapters (keys `posthogKey`/`sentryDsn` gate real clients, else
  noops); `shutdown` flushes PostHog.
- `alert(event)` — `createAlerting({client})` where client is a fetch
  alerter built by `factories.createAlerter({url})` when
  `alertWebhookUrl` (`ALERT_WEBHOOK_URL`) is set, else a noop. Default
  alerter POSTs `{text: message, name, severity, context}` JSON with
  `AbortSignal.timeout(5_000)`; non-2xx or network error → exactly one
  `console.warn` per send — it NEVER throws and NEVER re-alerts (no
  alert-on-alert loop; `createAlerting` already redacts `context`).
  `message`/`name` go verbatim — details/secrets belong in `context`;
  the failure warn logs `error.message`/`String(error)`, not the raw
  `Error` (serializes to `{}` in JSON pipelines).
- `measure(name, fn, ctx?)` — `startTimer` + `finally` emits
  `<name>.duration` via `track` (`durationMs` always wins the
  `properties` merge), so failures still emit duration and `fn`'s error
  rethrows unchanged. The `finally` emit is wrapped in try/catch — a
  throwing analytics adapter can never mask `fn`'s result or replace its
  error (best-effort telemetry, same swallow philosophy as the alerter;
  `ai-task-runtime.ts` guards `captureException` the same way).
  `MeasureContext` (`{workspaceId?, distinctId?, ...props}`) routes the
  event — `workspaceId ?? "platform"`, `distinctId ?? workspaceId ??
  "platform"`; routing keys are stripped from `properties` (`track`
  re-adds `workspaceId`).
- `logger` — `createStructuredLogger` writing one `JSON.stringify(record)`
  line per record to stdout (`console.log`), base context
  `{environment, service: "supastack-web"}`.

## Important Notes / NEVER Change

- `server-only` guard; provider secrets never leave this layer — the
  package contracts own redaction (`track`/`captureException`/`alert`
  all redact before the vendor client sees data). Alert `message`/`name`
  are NOT redacted (verbatim) — never interpolate error text or secrets
  into them.
- The alert webhook URL is server-only config — never expose it through
  `parsePublicConfig`; delivery failure logs go to `console.warn`, not
  back through `alert`.
- `factories` is all-or-nothing (tests inject the whole object);
  `alertWebhookUrl` flows to the singleton automatically via the
  `config.observability` spread.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-29 | Review fix: `measure`'s finally-emit wrapped in try/catch (throwing analytics adapter can't mask `fn`'s error/result); alert warn logs `error.message` not raw `Error`; `alert` docstring pins verbatim `message`/`name` | Devin |
| 2026-09-29 | `+=` `alertWebhookUrl` config, `createAlerter` factory (fetch POST `{text,name,severity,context}`, 5s timeout, warn-once failures), `alert`, `measure` (`<name>.duration` + platform fallback + emit-on-failure), `logger` (JSON stdout sink) | Devin |
