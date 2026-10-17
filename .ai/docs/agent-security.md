# docs/agent-security.md

> Last updated: 2026-10-07 | Protection: STANDARD

## Purpose

Shared security and acceptance checklist for agents setting up a product from
the kit. Ships to every platform checkout; backend-only commands explicitly
require the web checkout.

## Important Notes / NEVER Change

- Better Auth is the default and Auth.js is the selectable alternate; server-side
  workspace authorization is the shipped model. Supabase supplies
  Postgres/storage; enabling RLS does not make Better
  Auth sessions into Supabase JWTs or replace BFF authorization.
- The Supabase doctor checks public ordinary tables and direct anon/authenticated
  grants. State its limits; custom schemas, views, routines, inherited/PUBLIC
  grants and privileged roles need separate review.
- Secret diagnostics identify keys and outcomes without values. Structured
  logger context redaction does not sanitize arbitrary message strings.
- Direct console/provider sinks require separate review. Health probes DB
  connectivity only; live providers require functional checks. A denied foreign
  read needs a positive owner read to rule out an absent/broken record.
- Mobile uses Better Auth + Expo; desktop embeds the web app. Auth.js is an
  optional web adapter with separate provisioning limitations.
- Acceptance evidence includes two different users, forbidden cross-workspace
  reads/writes, session revocation, scheduler auth, and recovery. Health alone
  cannot prove authentication, migrations, isolation or production readiness.
- Never include competitor/private repository provenance in this mirror.

## Verification

- Independent review checked source and official PostgreSQL/Supabase RLS
  semantics. Applied adapter, FORCE RLS, health, positive-control and logging
  scope corrections. Platform map/link checks run with the export tests.
