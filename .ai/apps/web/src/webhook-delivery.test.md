# apps/web/src/webhook-delivery.test.ts

> Last updated: 2026-09-29 | Protection: STANDARD

## Purpose

Unit coverage for `webhook-delivery.ts` — emit fan-out, retry sweep, the
terminal-failure alert, and the production DNS re-validation.

## Coverage

- `emitWorkspaceEvent` — insert stamps `nextAttemptAt` (= `createdAt`) so
  the sweep can recover deliveries stranded by a crash; a caller
  `correlationId` lands inside the stored `payload` meta (absent when the
  caller has none, dropped when malformed — `""`/whitespace/oversized).
- `webhook.delivery_failed` alerting — `observability.alert` stays silent
  on retryable failures (backoff `pending`, incl. attempts=4 one below
  exhaustion) and on success; fires exactly once with
  `severity:"critical"`, the stable `Webhook delivery <id>
  permanently failed for workspace <id>` message, and scalar context
  (`attempts`/`correlationId?`/`deliveryId`/`eventType`/`responseCode`/
  `workspaceId`) when retries are exhausted or a pre-flight reject marks
  the row `final` — and the context omits `correlationId` when the stored
  payload predates it.
- Once-per-attempt guarantee — completion and failure updates match both
  `status='pending'` and the exact attempt count claimed by that worker.
  A stale completion while a newer attempt is still pending returns no row.
  The completion UPDATE's `.returning()` is queued `[]` to simulate a lost
  transition (row
  already failed / already delivered by a re-claimed attempt): the stale
  write is a silent no-op, no second alert. A dedicated case counts two
  `eq(status,'pending')` predicates per delivery — claim AND completion
  writes each carry the guard. `claimOnce` queues claim + row read +
  completion-win per attempt.
- `deliverDueWebhookDeliveries` — the WHERE clause is `isNull OR lte` on
  `nextAttemptAt` (asserted via mocked `drizzle-orm` `or`/`isNull`/`lte`
  call capture, not just the happy path). Claim semantics: a row whose
  claim UPDATE returns nothing (already leased by a concurrent pass) is
  skipped and not counted in `attempted`; the claim SET pushes
  `nextAttemptAt` to a 30s lease horizon without touching `status`; a
  crashed delivery is re-claimed once its lease expires.
- Production `deliverWebhookDelivery` (`NODE_ENV` stubbed): private or
  mixed DNS answers → permanent `failed` with `nextAttemptAt:null` and no
  network connection; lookup errors stay retryable (`pending` + future
  `nextAttemptAt`); public answers deliver; bracketed-v6 endpoints reach
  `dns.lookup` without brackets and deliver; non-production skips the DNS
  guard entirely.
- One 10s deadline covers DNS plus HTTPS. A controlled unresolved DNS lookup
  times out with a retryable write; resolving it afterward never calls HTTPS.
  A DNS lookup that consumes most of the deadline leaves only the remainder
  for the pinned request. Healthy DNS and pinned delivery remain covered.
- Connection pinning: the mocked `node:https.request` options are asserted
  for `agent:false` + pinned `family` + an `AbortSignal` timeout `signal` +
  the signing headers (`x-webhook-signature`/`x-webhook-id`/`x-webhook-
  timestamp` on `options.headers`), and the captured `lookup` callback is
  invoked directly — it replays only the validated address for the
  validated hostname, refuses a foreign hostname with an error, and
  `dns.lookup` is called exactly once (a rebinding answer can never reach
  the socket). Signed body is asserted via `request.end`; `incoming.resume`
  drains the response socket. The rotation case pins `resolved[0]` on the
  first attempt and `resolved[1]` on the retry.
- Redirect pin: `fetch` is called with `redirect: "manual"` — a 307
  records `responseCode` 307 + retryable `pending` instead of replaying
  the signed body to the `Location` target.

## Mocks

- `./auth-runtime` `database` — drizzle chain duck: `select().from()`
  exposes both `where()` (thenable, pops a queued row-set) and
  `innerJoin().where()`; `where()` results also carry `.limit()`;
  `insert().values()` / `update().set().where()` capture payloads. The
  update `where()` also chains `.returning()` which pops `updateResults` —
  an empty queue simulates a lost claim (concurrent lease).
- `drizzle-orm` — `and`/`eq`/`isNull`/`lte`/`or` wrapped in `vi.fn` over
  the real implementations (call-through, assertions on arguments).
- `node:dns` — `promises.lookup` stubbed; `node:https.request` mocked;
  `fetch` stubbed via `vi.stubGlobal`; `NODE_ENV` via `vi.stubEnv`.
- `./observability-runtime` — `serverObservability.alert` is a hoisted
  `vi.fn`; the alerting tests assert call count + argument shape.

## Change History


| Date | Change | Author |
| --- | --- | --- |
| 2026-09-29 | Once-per-row pins: lost-transition `returning:[]` cases (already-failed / already-delivered → no alert), `eq(status,'pending')` ×2 guard count, attempts=4 silence, malformed emit corrId dropped; `claimOnce` queues completion win; alert context asserts += `attempts`/`responseCode`; `eq` added to drizzle mock imports | Devin |
| 2026-09-29 | `webhook.delivery_failed` describe (retryable/success silent, exhaustion + pre-flight-final alert once, context shape incl. no-`correlationId` legacy row); `emitWorkspaceEvent` corrId payload-meta cases; `serverObservability.alert` mock; `PENDING_ROW` += `eventType`/`workspaceId` (alert context now read off the stored row) | Devin |
| 2026-09-27 | Claim-first rework: `updateResults` queue + `.returning()` on the update duck; `claimOnce` helper queues claim+read per attempt; sweep += claimed-skip/lease-set/re-claim cases; +DNS-answer rotation case; pinned-path asserts += `incoming.resume` + signature headers | Devin |
| 2026-09-27 | Pinned-path options assert += `signal` abort/timeout | Devin |
| 2026-09-27 | +redirect:manual pin + 307 retryable case; +bracketed-v6 delivery case | Devin |
| 2026-09-27 | Initial — covers the retry-gap fix + DNS re-validation | Devin |
| 2026-09-27 | +pinned-lookup rebinding case (single `dns.lookup`, host-scoped lookup refusal, `agent:false`/`family` assert); `node:https.request` mock replaces the fetch assertions on the production path | Devin |
| 2026-10-03 | Shared DNS+HTTPS deadline; late-DNS no-POST and slow-DNS timeout regressions; exact claimed-attempt fences while a newer lease remains pending | Codex |

## Security Fix (2026-09-27)

Production tests verify the validated DNS answer is pinned in the HTTPS request lookup (only that host, only that address — a second untrusted resolution provably never happens), signed body is sent, private/empty answers and insecure stored URLs never connect, and public IPv4/IPv6 endpoints deliver. Nonproduction redirect and localhost behavior remains covered.
