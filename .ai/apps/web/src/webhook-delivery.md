# apps/web/src/webhook-delivery.ts

> Last updated: 2026-09-29 | Protection: STANDARD

## Purpose

Outbound webhook delivery worker: fans workspace events out to subscribed
endpoints, records a `webhook_delivery` ledger row per endpoint, and POSTs
the signed payload (Stripe-style `x-webhook-signature` HMAC headers).
Server-only (`server-only` guard + `database` from `auth-runtime`).

## What It Does

- `emitWorkspaceEvent` — selects active endpoints whose `events` array
  includes the type, inserts a `pending` ledger row stamped
  `nextAttemptAt = now` (the sweep must be able to recover a crash before/
  inside the inline attempt), then calls `deliverWebhookDelivery` inline.
  `input.correlationId?` (the emitting request's `corr_<uuid>`) rides into
  `webhook_delivery.payload.correlationId` via `buildWebhookPayload` — the
  same id lands in the subscriber POST body, every retry attempt's read,
  and the terminal-failure alert context.
- `deliverWebhookDelivery` — atomically claims the row first:
  `UPDATE … SET attempts = attempts + 1, next_attempt_at = now + 30s lease
  WHERE id AND status='pending' AND (next_attempt_at IS NULL OR <= now)
  RETURNING attempts`. An empty claim means delivered/failed/not-due/
  already-leased → returns false without delivering. The claim winner then
  joins the row to its endpoint (url + secret; the select also reads the
  row's `workspaceId`/`eventType` for alert context), signs the body, and
  POSTs under one 10s deadline that starts before DNS (`runClaimedDelivery`). Production uses a pinned HTTPS
  connection; development uses `fetch` with `redirect: "manual"`. HTTP !ok
  (incl. any 3xx, which is never followed) and thrown errors both funnel to
  `markDeliveryFailed`, which schedules `nextWebhookRetryAt(attempts)` or
  marks `failed` once the 5-attempt budget is spent. Both completion writes
  (`delivered` / retryable `pending` / `failed`) are guarded by
  `status='pending' AND attempts=<claimed attempt>'` + `.returning()`. The
  exact attempt guard also prevents a stale worker from changing a newer
  pending lease. A crash before them leaves the row
  `pending` and claimable again once the lease expires. The claim and
  completion UPDATEs DO reject on a DB outage — `deliverWebhookDelivery`
  callers must catch (`tryEmitWorkspaceEvent` and the sweep's callers do);
  only delivery-attempt outcomes are written to the row rather than thrown.
- `deliverDueWebhookDeliveries(now)` — retry sweep: `pending` rows where
  `nextAttemptAt IS NULL OR <= now` (NULL tolerance recovers legacy rows
  inserted before the stamp existed), capped at 50 per pass. The select is
  only a candidate list — each row is re-checked and claimed atomically
  inside `deliverWebhookDelivery`, and `attempted` counts claims won.
  Registered as platform job `webhook.delivery-sweep` (every minute; see
  `job-handlers.ts` / `scheduler-runtime.ts`).
- `tryEmitWorkspaceEvent` — best-effort wrapper; a webhook failure must
  never undo the product write that produced the event.
- `markDeliveryFailed` terminal write → `serverObservability.alert({
  name: "webhook.delivery_failed", severity: "critical" })` — fires only
  when the guarded UPDATE actually transitioned the row to `failed`
  (`final:true` pre-flight rejects or the retry budget spent): once per
  row, enforced by the DB via `.returning()`, never per attempt. Message
  is the stable template
  `Webhook delivery <deliveryId> permanently failed for workspace <id>`
  (NEVER `error.message` — sent verbatim, may carry provider internals);
  context is scalars only: `{attempts, correlationId?, deliveryId,
  eventType, responseCode, workspaceId}` (`responseCode` null when the
  failure never got a response). Retryable attempts stay alert-free —
  retries are normal operation — and the alert call is sync
  fire-and-forget (`alert` never throws), so it can never break delivery
  or the product action behind `tryEmitWorkspaceEvent`. Inherent
  limitation: a crash between the terminal UPDATE and the alert call
  loses the alert; the row's `failed` status is the source of truth.
- `emitWorkspaceEvent` validates `input.correlationId` with the shared
  `isCorrelationId` (from `@supastack/observability`) — malformed ids are
  omitted from the payload meta, never written verbatim.

## Important Notes

- Production-only DNS re-validation: before connecting, the row's hostname is
  resolved with `dns.promises.lookup(host, { all, verbatim })` and every
  answer must pass `isPubliclyRoutableHost` — registration-time
  validation can't stop later DNS rebinding. Any private answer is a
  permanent failure (`markDeliveryFailed …, { final: true }` →
  `status:"failed"`, `nextAttemptAt:null`, no retry budget burned); a
  lookup ERROR is transient and takes the normal retry path.
  `dns.lookup` passes plain IP literals through, but REJECTS bracketed
  IPv6 (`[::1]` ENOTFOUNDs) — the URL hostname is normalized through
  `stripIpv6Brackets` first so public v6 endpoints deliver. The same 10s
  deadline starts before DNS and is passed to pinned HTTPS; an uncancellable
  lookup that resolves after timeout is ignored and cannot start a POST.
- Completion and retry/failure writes match both pending status and the exact
  claimed `attempts` value, so an older attempt cannot update a newer lease.
- Development `fetch` uses `redirect: "manual"`: a registered public endpoint
  answering `307 Location: http://169.254.169.254/` would otherwise have
  undici replay the POST body AND signature headers at the private
  target. With manual mode a 3xx lands in `!response.ok` →
  `markDeliveryFailed`, recording the real `responseCode`.
- Production `https.request` supplies a `lookup` callback pinned to the
  checked host+address: it answers only `lookupHost` (bracket-stripped URL
  hostname) and only with the validated `target` — a second untrusted DNS
  answer can never rebind the socket (lookup→connect TOCTOU closed), and a
  lookup for any other name errors out. `family: target.family` keeps the
  lookup contract single-address (autoSelectFamily off) and matches the
  checked answer. The original URL hostname remains the Host and TLS
  certificate identity. `agent:false` prevents a shared agent from reusing a
  socket that was connected under different DNS. Native HTTPS never follows
  redirects.
- The pinned `target` rotates within the validated answer set per attempt
  (`resolved[(attempts - 1) % resolved.length]` — attempts is 1-based from
  the claim), so a dead edge IP (unreachable v6, dead multi-A leg) does not
  burn every retry on the same unreachable address. DNS answers are
  re-validated fresh on each attempt.
- The claim lease (`WEBHOOK_CLAIM_LEASE_MS = 30s`) covers the full 10s DNS+HTTP
  timeout plus crash margin. `attempts` is bumped by the claim itself
  (`attempts + 1` SQL), so crash-burned attempts still count toward the
  5-attempt ceiling and completion writes reuse the claimed value — no
  double-increment.
- The DNS guard is skipped outside production so local receivers keep
  working.

## Bug Fixes

| Date | Bug | Cause | Fix |
| --- | --- | --- | --- |
| 2026-09-27 | Pending deliveries silently lost forever | Insert left `next_attempt_at` NULL and the sweep filtered `<= now`, so a crash between insert and the inline attempt stranded the row | `nextAttemptAt: now` on insert; sweep WHERE is `isNull OR lte` |
| 2026-09-27 | `deliverDueWebhookDeliveries` was dead code | No caller ever invoked the sweep | Wired as `webhook.delivery-sweep` platform job, `* * * * *` |
| 2026-09-27 | Redirect bypass: a public endpoint could `307` → `http://169.254.169.254/` and undici replayed the signed POST (body + `x-webhook-signature`) to the private target, unseen by the DNS gate | `fetch` used the default `redirect: "follow"` | `redirect: "manual"` — 3xx is an ordinary `!ok` failure that records `responseCode` |
| 2026-09-27 | Public bracketed-v6 endpoints (`https://[2606:4700::1]/`) registered fine but every delivery transient-failed until permanently failed | `new URL().hostname` keeps IPv6 brackets and `dns.lookup` rejects bracketed literals | `stripIpv6Brackets(hostname)` before `dns.lookup` |
| 2026-09-27 | Lookup→connect TOCTOU: `fetch` re-resolved DNS internally, so a rebound answer could route the signed POST to private space despite the preflight check | `fetch` performs its own untrusted resolution | Production delivers via `https.request` with a `lookup` pinned to the validated host+address, `family` pinned, `agent:false` |
| 2026-09-27 | One row could be delivered twice: the emit insert stamps `nextAttemptAt = now`, so a sweep tick landing mid-inline-delivery (or two overlapping sweep passes) re-read and re-POSTed the same row | Plain `SELECT … LIMIT 50` sweep had no claim/lease | `deliverWebhookDelivery` claims atomically (`UPDATE … attempts+1, next_attempt_at = now+30s WHERE pending AND still-due RETURNING`); losers get no row and skip. Completion writes overwrite the lease; lease expiry re-exposes crashed deliveries |
| 2026-09-27 | Every retry pinned `resolved[0]`, so a dead edge IP ate the whole retry budget | Target was always the first validated answer | Pin rotates per attempt: `resolved[(attempts - 1) % resolved.length]` |
| 2026-10-03 | A slow DNS lookup escaped the HTTP timeout and a stale attempt could overwrite a newer pending lease | The timer started after DNS and completion writes matched only `status='pending'` | One abort deadline covers DNS plus HTTPS; late DNS cannot start a POST; completion and retry writes also match the exact claimed attempt count |

## Change History


| Date | Change | Author |
| --- | --- | --- |
| 2026-09-29 | Completion writes guarded by `status='pending'` + `.returning()` — DB-enforced once-per-row alert (stale attempts silent); alert context += `attempts`/`responseCode`; payload corrId read null-guarded; `emitWorkspaceEvent` validates corrId via shared `isCorrelationId`; honest `deliverWebhookDelivery` throw doc | Devin |
| 2026-09-29 | `WorkspaceEventInput.correlationId?` → `webhook_delivery.payload` meta; `runClaimedDelivery` reads `workspaceId`/`eventType` + payload `correlationId` into a `DeliveryAttemptContext`; `markDeliveryFailed` fires critical `webhook.delivery_failed` on terminal writes only | Devin |
| 2026-09-27 | Atomic claim+lease in `deliverWebhookDelivery` (single in-flight delivery; `attempted` counts claims won); per-attempt DNS-answer rotation; hoisted `new URL(row.url)`; delivered write now clears `nextAttemptAt` | Devin |
| 2026-09-27 | `fetch` `redirect:"manual"`; `stripIpv6Brackets` before `dns.lookup` | Devin |
| 2026-09-27 | `nextAttemptAt` stamped on insert; NULL-tolerant sweep; production DNS re-validation before fetch; `markDeliveryFailed` `final` option | Devin |
| 2026-09-27 | Lookup→connect pinning (TOCTOU/rebinding closed): production POSTs via `https.request` with a `lookup` answering only the validated host with the validated address, `family` pinned, `agent:false`; stored-URL revalidation + empty-answer guard | Devin |

## Security Fix (2026-09-27)

Production revalidates the stored HTTPS URL, rejects empty/mixed private DNS answers, and connects via `https.request` whose socket `lookup` returns only the validated address and only for the validated hostname — the earlier lookup→fetch rebinding window is CLOSED. TLS and Host still use the URL hostname. Redirects are never followed. Local development retains fetch for localhost receivers.
