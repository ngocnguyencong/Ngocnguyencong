# Agent security and acceptance checklist

Read this before local setup or deployment, together with `AGENTS.md` and
`.env.example`. The web checkout owns the backend; mobile calls its API and
desktop embeds the hosted web app in a Tauri webview. Commands below that name
a backend script run in the
`supastack-web` checkout. Use fictional accounts and disposable records for
verification. Keep secrets and session values out of the agent's report.

## Database access and RLS

The kit defaults to Better Auth; `AUTH_PROVIDER=authjs` selects the alternate
adapter. Both use the web BFF and server-side Drizzle queries. Supabase provides
Postgres and optional storage; the kit does not use Supabase Auth. Mobile's
shipped auth client requires Better Auth and its Expo plugin. Auth.js web mode
has adapter-specific gaps, including new-user workspace provisioning; record
those checks as blocked until the selected adapter supports the product flow.
A
`workspaceId` column alone does not authorize access: resolve the workspace
from the authenticated caller, verify membership and role, and apply that
workspace to every user-owned read and write. Agents receive an injected
`ToolContext`; a model must never choose its own workspace.

Choose the database branch that matches the deployment:

| Database path                                    | Required protection                                                                                                                                  | Acceptance evidence                                                                                 |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Private Postgres in Docker/Coolify               | Keep database ports private or on loopback. Protect BFF queries with membership, role and `workspaceId` checks.                                      | Two unrelated users cannot read or mutate each other's workspace records through the API.           |
| Supabase with the kit's BFF                      | Restrict the Data API's access to kit tables. In the supastack-web checkout run `corepack pnpm supabase:doctor` after migrations and after upgrades. | Doctor exits 0 after fixes; BFF sign-in and workspace tests still pass.                             |
| Product deliberately adds direct Data API access | Design grants and RLS policies for its actual JWT identity and workspace membership before exposing tables.                                          | Test allowed and denied reads, inserts, updates and deletes using the real low-privilege API roles. |

For the BFF-only Supabase path, inspect the doctor's proposed SQL before
applying `corepack pnpm supabase:doctor --fix-rls` in the supastack-web checkout.
It enables RLS and revokes
direct grants from `anon` and `authenticated` in one transaction. Run the
doctor again: the fix invocation reports the problems it found, so it is
not the clean acceptance run. If the connecting role does not own the tables,
resolve the reported ownership/policy warning before applying a change that
could block the app.

The doctor covers ordinary tables in `public` and direct grants to `anon`
and `authenticated`. Separately review every other exposed schema, views,
functions, inherited or `PUBLIC` privileges and privileged roles. Its clean
result is evidence for that scope, not a complete database security audit.
With RLS enabled and no matching policies, ordinary roles have no row access;
table owners normally bypass it unless `FORCE ROW LEVEL SECURITY` is enabled.
Superusers and `BYPASSRLS` roles still bypass it. Do not use an
owner/service-role request to prove client isolation. Never add an allow-all
policy or disable RLS to repair a failing setup.

Do not paste `auth.uid()` policies from a Supabase Auth example into this
Better Auth setup: the kit does not establish that JWT identity. Changing to
a restricted database role or adding `FORCE ROW LEVEL SECURITY` needs an
explicit policy design and tests using that role.

See the official [PostgreSQL RLS semantics](https://www.postgresql.org/docs/16/ddl-rowsecurity.html)
and [Supabase Data API security guide](https://supabase.com/docs/guides/api/securing-your-api)
when extending this model.

## Authentication and authorization

- Set `APP_URL` to the exact public HTTPS origin in production. Keep
  `MOBILE_ALLOWED_ORIGINS` exact and limited to origins the product controls;
  preserve the trusted-origin validator and custom-domain checks.
- Use the configured auth adapter's real sign-in flow. A completed fake AI
  task or the local reference dashboard is a demo check, not proof of a saved
  user, session or authorized workspace.
- Keep enrollment, account linking, recovery and admin actions behind the
  existing verified-session and role checks. Provision `ADMIN_EMAILS`
  deliberately; ordinary members must not gain admin capabilities.
- API keys stay hashed, workspace scoped and limited to declared scopes.
  `/api/mcp` accepts bearer API keys, not browser cookie sessions. Invalid
  keys and denied write scopes must never produce a successful tool write.
- Configure `RATE_LIMIT_STORE=postgres` in production and measure the actual
  controlled proxy chain before setting `TRUSTED_PROXY_COUNT`. Preserve
  rate limits, bounded request bodies and admission gates.

## Secrets and logging

For local setup, use the setup runbook's env bootstrap helper in the
supastack-web checkout. It preserves valid keys and validates both files
without printing values. For production, generate separate values with a
secret manager and inject them into protected runtime configuration using
the formats in `.env.example`. Production database credentials must also be unique; the
`supastack:supastack` Compose example is for local development. Keep files
containing secrets gitignored and restrict their permissions. The local helper
writes new or changed files with POSIX mode `0600`; Windows files inherit NTFS
ACLs, so keep the checkout private to the intended account and verify access
when using a shared directory. Provider keys,
database URLs with passwords, scheduler keys, cookies and tokens stay on
the server; never use `NEXT_PUBLIC_` or `EXPO_PUBLIC_` for them.

Use the structured observability logger with a static message and structured
context. `redactSensitive` recursively redacts sensitive **keys** in context;
it does not scrub a password interpolated into a message or arbitrary free
text. Never log raw request bodies, authorization headers, `.env` contents,
provider responses or complete connection strings. Disable shell tracing
before secret handling. Validate Compose with `config --quiet`; a printed
resolved config can include every value from `env_file`.

Report command names, exit codes, HTTP statuses, safe correlation IDs and
key names. Sanitize diagnostic output before placing it in chat, an issue or
an acceptance report. Keep audit events, webhook and job records enabled;
decide who can read logs, how long they are retained and where failures alert.
Verify redaction with a fictional marker in a disposable test, never by
injecting a production key into a log. Review direct `console.*` calls and
third-party logging separately: the structured logger's test does not cover
those sinks, and existing direct error logging may include unsanitized text.

## Acceptance checks

Run after migrations against the selected environment. Mark every check
`PASS`, `FAIL`, `BLOCKED` or `NOT RUN` with evidence. A failed check blocks
the corresponding readiness claim; unavailable credentials/tools are not a
pass. Do not send billable requests or publish without explicit consent.

| Check                    | Expected result                                                                                                                                                                                                                                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Health and migrations    | `/api/health` returns 200 with `status: ok`; it probes database connectivity and lists configured provider kinds, not live provider health. The migration command exits 0 and a second run applies nothing. Verify critical providers with their own functional checks; health does not prove schema readiness.        |
| Real sign-in             | A fictional user completes the configured auth flow, receives a session and loads persisted workspace data. Production requires a working transactional email provider for email auth; `/mail-preview` is dev-only.                                                                                                    |
| Unauthenticated API      | A protected endpoint rejects a request without a session/API key; no workspace data is returned.                                                                                                                                                                                                                       |
| Cross-user isolation     | User A and unrelated user B own different workspaces. First confirm A can read the disposable record. As B, request A's record IDs and workspace IDs in read and write paths. Expect denial or an empty authorized result; confirm A's data is unchanged. Switching workspaces as one member is insufficient evidence. |
| Roles and revocation     | A member cannot perform owner/admin actions. After sign-out or revocation, replay the old session against a protected API and confirm it is denied.                                                                                                                                                                    |
| Scheduler auth           | Missing/wrong `x-scheduler-key` returns 401 when configured; the authorized tick returns 200. An unset secret returns 404 and is not a completed scheduler setup.                                                                                                                                                      |
| Supabase exposure        | Run the scoped doctor and review additional exposed objects/roles above. Mark not applicable for private Postgres without a Data API.                                                                                                                                                                                  |
| Logs and secrets         | Secret files are ignored; diagnostics omit values; fictional redaction checks pass; direct console/provider sinks are reviewed separately; the audit trail remains available.                                                                                                                                          |
| Network and TLS          | HTTPS origin matches auth config. Database, app upstream and storage administration ports are not publicly reachable; verify externally as well as from Compose bindings.                                                                                                                                              |
| Persistence and recovery | A container restart preserves saved database data. Document a backup destination, retention and a successful restore into a separate disposable database. Do not restore over live data.                                                                                                                               |

## Upgrades and recovery

Record the app revision/image digest and migration state before an upgrade.
Take a database backup and verify the restore procedure before migrations;
a Docker volume on the same VPS is not a backup. Keep `CREDENTIAL_ENCRYPTION_KEY`
stable across restarts/upgrades so previously encrypted credentials remain
readable. Rotating it requires a data re-encryption plan.

Apply migrations once against the correct target, deploy the chosen revision,
then repeat the acceptance checks. Rolling back an image does not undo
migrations: use an older image only if it is compatible with the new schema.
Otherwise stop and prepare a forward repair or an explicitly approved restore.
Never delete volumes, run a destructive reset or overwrite live secrets to
recover from a failed checkpoint.

End the agent handoff with the platform/setup path, revision, safe base URL,
checks and evidence, any remaining blockers, and whether deployment was
authorized and actually performed. List the next concrete action for each
`BLOCKED` or `NOT RUN` item.
