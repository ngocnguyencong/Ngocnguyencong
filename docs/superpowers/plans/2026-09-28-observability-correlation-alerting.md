# Plan: request correlation, duration metrics, and failure alerting

Date: 2026-09-28 · Branch: `feat/observability-correlation-alerting`

## Goal

Close the observability gaps a buyer asked about: **correlate a user request
with its background job and billing webhook**, emit **duration metrics**, and
**alert on failures** — all on the existing adapter boundary
(`packages/observability` contracts + `observability-runtime.ts` composition;
Sentry/PostHog stay the only vendor clients, alerting gets a generic HTTPS
webhook so it works with Slack/Discord/PagerDuty-style endpoints).

## Architecture constraints (existing)

- `packages/observability` owns the vendor-neutral contracts:
  `redactSensitive`, `createStructuredLogger`, `createObservability`
  ({`track`, `captureException`}), `AnalyticsEvent` {`distinctId`, `name`,
  `properties?`, `workspaceId`}, `ErrorContext` requires `workspaceId`.
- `apps/web/src/observability-runtime.ts` composes PostHog + Sentry via
  `createServerObservability({config, factories})`; `serverObservability`
  singleton = `{captureException, track, shutdown}`; noops when unconfigured.
- `apps/web/src/job-handlers.ts`: `runJobHandler(type, input, ctx, handlers)`
  is the never-throw boundary — captures failures to observability, returns
  `{ok:false}`. `JobHandlerContext` = {`scheduleId`, `workspaceId`, `now`,
  plus injectables}. `job.completed` events carry `{scheduleId, type, ...}`.
- `apps/web/src/ai-task-runtime.ts`: executor `run(payload)` tracks
  `ai_task_completed` / captures `ai.task.execute` with `{taskId, workspaceId}`.
- `apps/web/src/ai-task-bff.ts`: submission path — durable task record +
  idempotency + dispatch. Payload flows to the executor.
- `apps/web/src/webhook-delivery.ts`: outgoing workspace webhooks —
  `emitWorkspaceEvent` fans out to `webhookDelivery` rows;
  `deliverWebhookDelivery` claims then `runClaimedDelivery` attempts;
  `markDeliveryFailed` with exhausted retries/`final:true` sets `status=failed`.
- Incoming billing webhooks: `app/api/billing/webhook/<provider>/route.ts`
  share a receiver builder (see `app/api/billing/webhook/routes.test.ts`).
- `packages/config/src/index.ts`: env → `serverConfig.observability` currently
  {`posthogHost?`, `posthogKey?`, `sentryDsn?`}; `rawServerConfigSchema` is
  the env surface; `publicConfigSchema` is separate and must NOT see alert
  URLs (server-only).
- Env inventory lives in root `.env.example`.
- TDD is the repo convention; focused vitest per package; `.ai/` mirror docs
  must be maintained for every touched/new file.

## Design decisions

- **Correlation id** = `corr_<randomUUID>`-style string minted once at each
  entry boundary (task submit, incoming webhook, job dispatch) and carried in
  event `properties.correlationId` + error `extra.correlationId` + task/job
  payloads — no DB column (taskId/deliveryId already join records; the
  correlation id links the _request_ to those records in events/logs).
- **Duration metrics** = `measure(name, fn, ctx?)` helper: times an async
  fn, emits `<name>.duration` analytics event with `durationMs` + ctx props,
  rethrows errors unchanged. No span tree — honest "metrics" scope.
- **Alerting** = `serverObservability.alert({name, severity, message,
context?})` → `AlertClient` adapter → generic HTTPS JSON webhook POST
  (`{text, severity, name, context}`), 5s timeout, fire-and-forget, never
  throws, noops when `ALERT_WEBHOOK_URL` unset. Fired on: job handler failure
  (`job.failed`), outgoing webhook delivery exhausted (`webhook.delivery_failed`),
  and unknown job type. Alert delivery failure is logged, never re-alerted.
- **Structured logs** = `serverLogger` singleton —
  `createStructuredLogger` sink writing one JSON line per record to stdout
  (`console.log`), base context `{environment, service:"web"}`.

## Tasks

### Task 1 — packages/observability primitives

New exports in `packages/observability/src/index.ts` (or a sibling module
re-exported through index, matching existing style):

- `AlertSeverity = "warning" | "critical"`, `AlertEvent` {`name`, `message`,
  `severity`, `context?`}, `AlertClient` {`send(alert): Promise<void>|void`},
  `createAlerting({client})` → `{alert(event): void}` — redacts `context` via
  `redactSensitive`, calls `client.send`, swallows async rejections (alerting
  must never throw into product code).
- `newCorrelationId(): string` — `corr_${crypto.randomUUID()}` (node:crypto).
- `startTimer()` → `{elapsedMs(): number}` using `performance.now()` or
  `Date.now()`; `timed`/`measureDuration` helper as the task needs (keep it
  minimal — a timer primitive is enough; composition happens in the runtime).
- Tests in `index.test.ts`: alert context redaction, swallowed client
  rejection, correlation-id uniqueness/format, timer monotonicity.

### Task 2 — packages/config `ALERT_WEBHOOK_URL`

- Env schema: optional URL env `ALERT_WEBHOOK_URL` next to `SENTRY_DSN` →
  `serverConfig.observability.alertWebhookUrl` (omitted when unset).
- Config tests: unset → absent, valid URL → present, invalid → parse error.
- NOT added to `publicConfigSchema`.

### Task 3 — apps/web observability runtime wiring

`apps/web/src/observability-runtime.ts`:

- `ServerObservabilityConfig` += `alertWebhookUrl?`.
- `ServerObservabilityFactories` += `createAlerter({url}): AlertClient`.
- Default alerter: `fetch(url, {method:"POST", headers:{"content-type":
"application/json"}, body: JSON.stringify({text: message, name, severity,
context}), signal: AbortSignal.timeout(5000)})`; non-2xx or network error →
  `console.warn` once per call — never throws, never calls `alert` again.
- `serverObservability` gains: `alert`, `measure(name, fn, ctx?)` (timer +
  `track({name: `${name}.duration`, properties:{durationMs,...ctx}})`, rethrow),
  `logger` (structured JSON stdout sink with base {environment, service}).
- Tests: configured→POST with redacted context; unconfigured→no fetch; failed
  POST swallowed; measure emits duration + rethrows; logger redacts secrets.

### Task 4 — correlation + alerts on AI-task and job paths

- `ai-task-bff.ts` submission: mint `correlationId`, add to task payload +
  `ai_task_submitted` track props. `ai-task-runtime.ts`: executor events and
  `captureException` extras carry `payload.correlationId`. Dispatch path must
  tolerate a missing key (old rows) — optional field, not a schema bump.
- `job-handlers.ts`: `JobHandlerContext` += optional `correlationId`;
  `runJobHandler` mints one when absent; `job.completed` props and failure
  `captureException` extras include it; on failure AND on unknown type →
  `serverObservability.alert({name:"job.failed", severity:"warning", ...})`
  (injectable `alert?` dep alongside `track?` for tests).
- Callers of `runJobHandler` (scheduler tick, Trigger `job.run`) pass a fresh
  `correlationId` per dispatched job.
- Tests: correlationId present on submit→execute events; missing id tolerated;
  job failure/unknown-type alert fired with redacted context; ok-run no alert.

### Task 5 — correlation + alert on webhook paths

- Incoming billing webhook receiver builder (shared by
  `app/api/billing/webhook/*/route.ts`): mint `correlationId` per request →
  into ledger/emit context.
- `emitWorkspaceEvent` accepts optional `correlationId` → included in
  `webhookDelivery` payload meta + passed to delivery attempts;
  `runClaimedDelivery`/`markDeliveryFailed` (status→`failed` only, i.e.
  `final:true` or retries exhausted) → `alert({name:"webhook.delivery_failed"})`.
- Keep delivery attempts alert-free until terminal failure (retries are
  normal operation).
- Tests: event → delivery carries correlationId; terminal failure alerts
  once; pending retry does not alert.

### Task 6 — docs, env, mirrors

- `.env.example`: `ALERT_WEBHOOK_URL` in the observability block with a
  one-line comment (generic HTTPS endpoint, Slack-compatible `{text}` shape).
- `modules/observability` guide in `apps/web/src/resources/content.ts`:
  extend with alerting (env + behavior), correlation ids on task/job/webhook
  events, `<name>.duration` metrics, `serverLogger` JSON lines.
- `.ai/` mirrors for every touched file + `PROJECT_CONTEXT.md` entry.
