# llms.txt

> Last updated: 2026-10-12 | Protection: STANDARD

## Purpose

Repo-root agent entry map following the llmstxt.org convention: `#` H1, `>`
blockquote summary, short intro prose, then `##` sections of
`- [Label](path): description` links with repo-relative targets, ending in an
`## Optional` section for secondary material.

## Important Notes / NEVER Change

- Sections: Start here (AGENTS.md contract, README, PRODUCT,
  `.ai/PROJECT_CONTEXT.md`, `.env.example`) → Agent setup & deploy
  (`docs/agent-setup.md` runbook, compose files, Dockerfile, deployment +
  Coolify docs, `prompts/agent-setup.md`) → Security protocols → Guides →
  Agent prompts → Architecture map → Testing & verification → Optional.
- The Security protocols section is the load-bearing one: every claim links a
  real code/doc anchor — `workspaceId` scoping (db schema + injected
  `ToolContext`), server-only secrets with `openssl rand` recipes and the
  `NEXT_PUBLIC_`/`EXPO_PUBLIC_` ban, `AUTH_PROVIDER` capabilities + invite
  gate, `supabase:doctor` RLS audit/`--fix-rls`, fixed-window rate limiting
  (`RATE_LIMIT_STORE` postgres-in-prod, `TRUSTED_PROXY_COUNT` XFF hops),
  Postgres audit/webhook/job tables + `redactSensitive` + `ALERT_WEBHOOK_URL`,
  signature-verified billing webhook receivers, outbound-webhook SSRF
  guarding (`webhooks.ts` host allowlist + delivery-time DNS re-resolve +
  `x-webhook-signature` HMAC), bounded request intake (`request-body.ts`
  caps + `rate-limit-route.ts` admission gates + verified-client-IP
  stripping), exact-match `trustedOrigins`, `sk_` bearer-only `/api/mcp`,
  opt-in Turnstile, `PUBLIC_AI_DAILY_BUDGET_MICROUNITS=0` disabled-by-default
  public AI, transactional-only email, `x-scheduler-key` scheduler tick that
  404s while unset, consent boundary, neutral demo content.
- Security protocols also link `docs/agent-security.md` for the distinction
  between the configured Better Auth/Auth.js BFF sessions and PostgREST
  exposure/RLS checks, plus safe diagnostic-log handling.
- The preamble (between blockquote and first `##`) must stay headingless —
  it carries the "Important notes for agents" bullets (server-only secrets,
  `workspaceId` scoping, consent boundary, fail-twice-then-report) that
  duplicate the Security section's top rules in compressed form.
- `tests/llms-txt.test.ts` guards every relative link target against
  existence — update `llms.txt` links when files move or are renamed.
- Intro prose notes the in-app docs surface lives in `apps/web/src/resources/`
  rendered under `/docs` — keep that distinction (repo docs vs product docs).

## Change History

- 2026-10-12: `docs/desktop-updates.md` added to Guides (signed desktop
  updates — key generation, endpoint hosting, `plugins.updater` overlay,
  launch-at-login); inserted alphabetically between
  `custom-billing-adapter.md` and `github-auth-setup.md`.
- 2026-10-10: `scripts/setup.mjs` linked under Agent setup & deploy — the
  interactive `pnpm setup` wizard (preflight, env bootstrap, optional
  install/migrations) with its no-write `--check` and safe-default `--yes`
  modes described in the annotation.
- 2026-10-08: Audit fixes — preamble secret-generation pointer corrected to
  `scripts/setup-env.mjs` (the runbook documents formats, not `openssl rand`
  recipes), and `docs/aws-ses.md` added to Guides (the only shipped doc the
  map omitted; sub-repo `renderLlmsTxt` already lists it).
- 2026-10-07: Add the tested, noninteractive env bootstrap helper to the setup
  entry map; it preserves valid keys and provides a no-write validation mode.

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-07 | Linked shared security checklist; native maps qualify backend setup/prompt as web-checkout content; product `/llms.txt` gains linked security protocols | Codex |
| 2026-10-06 | Created agent entry map + link-guard test; preamble "Important notes" bullets added at integration | Devin |
| 2026-10-06 | Quality-review wording fix: `.ai/` mirror claim softened ("files carry mirror docs", not "every shipped file has one") | Devin |
| 2026-10-06 | Audit-swarm round: +3 Security bullets (outbound-webhook SSRF, bounded request intake + admission gates, exact-match trustedOrigins + verified-IP); consent bullet += destructive ops; README note corrected to `--filter @supastack/web dev`; ToolContext defined-in anchor; playwright 3100 = default | Devin | README note corrected; ToolContext defined-in anchor; playwright 3100 = default |
