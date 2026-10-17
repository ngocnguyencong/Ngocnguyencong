# Production AI task runtime

The local reference app remains credential-free. The production boundary is separate:

```text
POST /api/ai/tasks
  → authenticated workspace + active entitlement
  → durable task_run
  → Trigger.dev ai.generate
  → capability-aware ModelRouter
  → ai_usage + task result
  → transactional completion email + delivery log
```

## Reference interface

The root Web page selects its interface from server configuration at request time:

- `APP_ENV=local` or `test` with **all** fake/local providers keeps the credential-free demo.
- `APP_ENV=development` or `production`, or any configured non-local provider, uses the durable
  Reference App. Sign in through `/auth`, manage Web subscriptions through `/billing`, then return
  to `/` to submit an AI task. This interface never grants a demo entitlement.
- Submission requires `JOB_PROVIDER=trigger` and at least one enabled alias. `AI_MODEL_POLICY`
  controls the available alias choices; empty lists remove aliases from the form. Only alias names
  reach the browser, not the configured model IDs or provider secrets.

The form sends only prompt, alias and capability requirements to the same-origin production API.
Workspace ownership, entitlement, model selection and spending limits remain server-enforced.
The task ID is retained in the page URL for refresh restoration; possession of that URL does not
grant access. Task status/results are read from the authenticated durable API, not browser storage.
Completion of generation does not by itself prove completion-email delivery.

The offline production-interface browser suite uses intercepted API fixtures and does **not** prove
real authentication, database persistence, Trigger execution, billing or email delivery. Those
remain the separate deployment/sandbox acceptance below.

Run `pnpm test:e2e:production` for this offline interface suite; PR CI and `pnpm verify:local`
include it alongside the existing local golden path.

## Task API failure boundaries

After Trigger confirms enqueue, a failed `provider_run_id` attachment does not invalidate the
accepted task: POST still returns its durable task ID and confirmed provider run ID. The worker
and authenticated read API use the durable task ID independently of this metadata. No extra
enqueue or failed-task transition is attempted. A configured error reporter receives the safe
`ai.task.attachRun` diagnostic with server-derived task, run and workspace IDs; reporter failures
cannot replace the accepted response. If the diagnostic occurs, reconcile the missing run metadata
using those IDs through trusted operations rather than submitting the task again.

Task GET failures return generic JSON `internalError` responses; raw database/session exceptions
are not returned or forwarded to diagnostics.

The Reference App creates an `Idempotency-Key` before POST and retains it in the page URL until
dispatch is confirmed. Keys must contain 16–128 ASCII letters, digits, underscores or hyphens.
The server hashes the key together with the authenticated workspace ID and atomically reserves
one immutable task. Reusing a key with changed input returns `409 idempotencyConflict`.

After an ambiguous enqueue failure, keyed requests return HTTP 202 for the saved queued task.
This means dispatch is uncertain, not that Trigger accepted the work. Use **Resume submission**
or refresh the recovery URL: POST `{ "resume": true }` with the same key reads the original
server-saved input and retries the same task-scoped Trigger idempotency key. Already running or
terminal tasks return their saved state without another enqueue. Authentication, workspace scope
and entitlement checks still apply; the recovery URL is not an access credential. If no reservation
exists, recovery returns 404 and the form permits submitting again under the same key.

There is no automatic outbox dispatcher: a queued reservation may require explicit recovery.
Unkeyed API callers retain the legacy submission behavior and cannot safely blind-retry a lost
response. Trigger deduplication plus the worker's atomic claim is not an end-to-end exactly-once
guarantee. Never manually reset a running task to queued without investigating its side effects.

The dedicated database acceptance test is gated by `TEST_SUBMISSION_DATABASE_URL` and runs after
the migration suite in CI. Use an isolated test database: it applies committed migrations and
creates/removes a unique test workspace. Offline SQL-builder tests do not prove real concurrency.

## Prepare the database

Run all Drizzle migrations. Migration `0003_flippant_omega_sentinel` adds encrypted BYOK envelopes
and the workspace AI policy.

Insert at least one enabled `ai_model` and one immutable, effective `ai_model_price` for the selected
provider. Use provider-published model/version and price information current on the insertion date;
never overwrite an old price row. Close it with `effective_to` and insert a new `priceId` when pricing
changes. All rates are integer microunits per million tokens.

`workspace_ai_policy.key_mode` may be `platform` or `byok`. Platform-funded workspaces with no
policy row or a null `monthly_budget_microunits` use a $5 UTC-month default
(`5_000_000` microunits). An explicit value, including zero, overrides the default. BYOK workspaces
with a null limit may remain unlimited because their provider key bears the cost. The worker and
synchronous chat path reserve estimated spend before each provider attempt, then record actual usage.
The default applies to existing workspaces without a policy row; set an explicit platform limit when
the product needs a different ceiling.

## Store BYOK credentials

Use `WorkspaceProviderKeyVault` with `createDrizzleProviderCredentialRepository` inside an
authenticated server-only settings boundary. `put({ workspaceId, provider, apiKey })` encrypts with
AES-256-GCM before the repository receives the record. The database contains only ciphertext, IV,
authentication tag, algorithm, and version. Never call this from a client bundle, log the input, or
return the plaintext. Set `CREDENTIAL_ENCRYPTION_KEY` to a Base64-encoded 32-byte key and keep it in
the deployment secret store.

## Deploy the Trigger worker

### Configure model routing without editing Starter Core

Set this server-only environment value on both Web/BFF and Trigger deployments:

```dotenv
AI_MODEL_POLICY='{"fast":["model-small"],"smart":["model-large","model-small"],"cheap":[]}'
```

Values are `ai_model.id` catalog IDs, not provider model names. Each list is an ordered
allowlist: first eligible model wins, subsequent eligible models are fallback candidates only
for retryable failures. `[]` disables that alias. All three keys are required; unknown keys,
duplicate/empty IDs and malformed JSON fail configuration validation. To disable all aliases,
set all three lists to `[]`. This disables generation through the production router, not the
entire AI UI/endpoint, and does not remove the selected provider's credential requirements.

Unlisted models are never fallback candidates. Listed models that are disabled, absent, belong
to a different selected provider or lack a currently effective price are unavailable; routing
can use the next listed eligible model. If no listed model satisfies capabilities and budget,
the request fails before provider access. Workspace BYOK and per-attempt authorization still
apply. This policy does not enable cross-provider routing in the single-provider composition.

Omit the variable entirely to preserve the existing alphabetical catalog order for all aliases;
an empty environment string is not an omitted policy. Restart/redeploy after changing it.
The policy is not browser input or part of public config. Prices and historical usage records
are unchanged. The local reference demo retains its deterministic fixture routing.

Set the selected real AI/email provider configuration, database URL, encryption key,
`TRIGGER_PROJECT_REF`, and `TRIGGER_SECRET_KEY` in the isolated Trigger.dev environment. Then run:

```bash
pnpm --filter @supastack/web trigger:deploy
```

The concrete task is `ai.generate`. Its three-attempt retry policy and five-minute maximum duration
are Trigger.dev-specific and are not part of `JobRunner`.

The AI execution path is claimed once, including budget authorization and immutable usage/result
persistence. Re-entry for a completed task retries only its missing completion notification and
skips delivery once the workspace-scoped accepted record exists. A running or failed task cannot
be claimed again. After three unsuccessful notification attempts, resolve the mail outage and
manually replay the same trusted task payload; the saved AI result remains available.

Notification delivery is at-least-once: provider acceptance followed by a process/log-write failure
can produce a duplicate notification on retry. The current adapters do not offer an atomic
provider-send plus database-log transaction; do not claim exactly-once email delivery.

## Exercise the boundary

With an authenticated Better Auth cookie and exact application Origin, submit only the allowed
browser fields:

```json
{
  "alias": "smart",
  "prompt": "Summarize this note.",
  "requirements": {
    "minContext": 32000,
    "structuredOutput": true
  }
}
```

The server derives workspace, recipient, entitlement, provider, key mode, budget, model, and price.
New durable AI tasks and synchronous chat replies share user and workspace submission limits. A
previously recorded idempotent task can still be resumed when a new-task limit is exhausted.
Poll `GET /api/ai/tasks/{taskId}` with the same authenticated session. Confirm the completed task,
immutable `priceId` usage row, integer cost, and transactional delivery row all carry the same
`workspaceId`.
