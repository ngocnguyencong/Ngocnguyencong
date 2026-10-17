# scripts/setup-env.mjs

> Last updated: 2026-10-07 | Protection: STANDARD

## Purpose

Zero-dependency, noninteractive env bootstrap for host Node or the Node 22
container. Shipped only with the web backend.

## Contract

- Export `setupEnvironment(root, { check = false } = {})` for isolated tests.
- Create absent `.env` and `apps/web/.env.local` from `.env.example`.
- Generate only missing, empty or replace-with placeholder secrets. Reuse
  existing valid keys across files; reject mismatches and invalid non-placeholder
  keys before writes. Preserve all unrelated existing content and valid keys.
- `--check` validates existence, key formats and consistency without writes.
- Never print values or accept secret CLI arguments. Reject symlinks/non-files
  for the template, destination files, checkout root and destination parents.
- Preserve CRLF and inline comments when filling a placeholder assignment.
- Write changed files atomically with POSIX mode 0600; Windows files inherit
  NTFS ACLs. Temporary names match `.env.*` ignore rules. Production DB
  passwords and other provider configuration are configured separately.

## Decisions

- Validate both env files and plan all key changes before writing either file.
  Invalid non-placeholder keys fail rather than rotate credentials that may
  already protect persisted data. Cross-file conflicts report only key names.
- Use only Node built-ins so a Docker/Podman host needs no host Node install,
  package download or provider call to bootstrap.

## Verification

- Twelve isolated-fixture tests cover generation, idempotence, key reuse,
  CRLF/comments, conflict/invalid/duplicate denial, no-write checks, path
  containment and safe CLI output. No operator env files are touched.
- Each preservation/path regression failed before its fix. Live container
  execution still requires a running engine.
