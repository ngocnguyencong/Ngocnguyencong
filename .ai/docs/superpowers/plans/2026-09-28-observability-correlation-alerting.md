# Observability Correlation & Alerting Plan

Mirrors `docs/superpowers/plans/2026-09-28-observability-correlation-alerting.md`.

The plan adds request correlation ids (`corr_<uuid>` minted at AI-task submission, billing webhook routes, and scheduler dispatch), a `measure(name, fn)` helper emitting `<name>.duration` analytics events, failure alerting through a generic HTTPS endpoint (`ALERT_WEBHOOK_URL` → `serverObservability.alert`), and a structured JSON logger on the existing observability adapter boundary. It records intended implementation and verification steps; it does not establish shipped behavior. The source plan is formatted with the repository's Prettier rules.

Status note: executed 2026-09-28. All tasks completed. `job.failed` shipped at warning severity; `webhook.delivery_failed` fires critical only on terminal delivery failure.
