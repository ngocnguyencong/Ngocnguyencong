# Dockerfile

## Purpose

Build the standalone web app with locked dependencies and run its production
server. Runtime provider secrets come from deployment configuration.

## Security contract

- Build-only commands explicitly select local configuration so compilation
  needs no production credentials. The separate runner still enforces production.

- The final command forces `APP_ENV=production` before executing the standalone
  server, including when a runtime env-file contains local/test mode values.

- 2026-10-06: The runner stage now drops to the image's unprivileged `node`
  user (uid 1000): `RUN mkdir -p apps/web/.next/cache && chown -R node:node
  apps/web` then `USER node` before `EXPOSE`/`CMD`. Verified by inspection —
  the standalone server only writes under `.next/cache` (image/ISR cache);
  no env files or other paths are written at runtime. One deliberate carve-
  out: `MARKETING_LEAD_STORE=local` would write `process.cwd()/.data/` — it
  is documented dev-only and stays unwritable in the image rather than
  widening the chown.

- 2026-10-03: The final runner defaults the application environment to production
  so absent deployment configuration fails closed. Dependency patches are copied
  before frozen installation. A regression against the real configuration parser
  failed before the default changed and passes afterward. No image build or
  provider request was performed.

## Important Notes / NEVER Change

- Never bake provider credentials into an image.
- Dependency patches must be available during frozen installation.
- Keep the `USER node` non-root runtime; only `.next/cache` is writable.
