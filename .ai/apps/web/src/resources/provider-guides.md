# provider-guides.ts

## Purpose

Dedicated, beginner-oriented setup guides for the 23 nonlocal billing, email, AI, and OAuth providers exposed by the Web docs tab.

## Content

- The 23 guide slugs and four existing groups remain stable: `Authentication`, `Billing & entitlements`, `AI & agents`, and `Jobs & email`.
- Existing section IDs `setup`, `connect`, and `verify` remain stable. A shared `restart` section now gives the exact command as a code block.
- Every guide explains the local Web prerequisite, the distinction between terminal/editor/provider dashboard, `.env.local`, server-only credentials, provider-specific setup, local or sandbox testing, recovery, and production configuration.
- Setup code blocks contain environment assignments for `apps/web/.env.local`. Provider webhook URLs and OAuth callback URLs are in the Connect section so they are registered in the provider dashboard rather than pasted into the environment file. `APP_URL` and an OpenAI-compatible API base URL remain legitimate environment settings.
- The setup section links to environment-variable reference, database setup, and official provider dashboard/documentation pages. SMTP links to the SMTP standard; OpenAI-compatible API links to its compatibility guide because neither has one shared vendor dashboard.
- Local `/ai` is a reference UI demo that works without PostgreSQL. Real `/auth`, workspace data, authenticated checkout, account email flows, and real AI requests require PostgreSQL and migrations. Web settings belong in `apps/web/.env.local`; from the repository root, restart Web with `corepack pnpm --filter @supastack/web dev`.
- Billing examples match the eight configured adapters and their webhook routes. Email examples cover seven nonlocal senders and the transactional-only contract, independently from `JOB_PROVIDER`. AI covers OpenAI, Anthropic, and OpenAI-compatible endpoints; model IDs and prices come from the database catalog. OAuth examples cover five configured providers and the callback IDs for Better Auth and Auth.js.
- Provider names, slugs, section IDs, code samples, routes, and URLs remain source-owned. Secrets stay server-side and are never included as real values.
- There are 142 distinct current human-facing source strings, all present in the de/es/fr dictionaries.

## Important Notes

- This content-only module is imported by `apps/web/src/resources/content.ts` and uses exported `Guide` and `Section` types.
- Environment variable names were checked against `.env.example` and provider configuration/runtime code. No real `.env` file was opened.
- Keep provider guide changes with their exact-source-key dictionaries and this mirror. Do not edit the docs renderer, navigation, styles, or runtime as part of this content slice.

## Change History

- 2026-10-13 — Setup copy now names `/ai` as the local AI-task demo and keeps `/dashboard` as analytics-only.
- 2026-10-01 — Added 23 provider setup guides with runtime-verified environment keys, webhook routes, workflow sections, and related links.
- 2026-10-02 — Expanded all 23 guides for first-time developers; added dashboard and official documentation links, Web setup and restart steps, database prerequisites, distinct environment/callback/webhook code blocks, verification and troubleshooting, and local/sandbox/production guidance. Added de/es/fr translations for all new human-facing source strings.

## Open Threads

- **Status:** none
- **Intent:** The provider-guide beginner content and translations are complete; root owns cross-resource integration checks.
- **Next steps:** None for this content slice.
- **Blockers / notes:** No runtime, UI, deployment, commit, or push changes were made.

## 2026-10-02 integration

Beginner prose and commands are implemented. New locale strings are consolidated in the three beginners maps after the original dictionaries; preserve command/URL/path identifiers. Native release instructions use filtered Desktop package commands. Verification and mirrors remain local.

## 2026-10-04 — AWS SES

AWS SES setup guidance covers verified identity/region/sandbox, classic IAM SMTP creation/management links, separate API keys or roles/session tokens, SMTP STARTTLS, all-platform server-only configuration, and current Mail Manager pricing. The optional open/mTLS endpoint fee is $50/month; authenticated endpoints are currently complimentary. Guide links, localized overlays and environment inventories stay aligned.
