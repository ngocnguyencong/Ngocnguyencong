# container-security.test.ts

## Purpose

Apply the final image stage's environment to the real configuration parser and
assert that an unconfigured production image cannot silently boot local mode.
Also check that the build-only command has an explicit local environment which
the real parser accepts without relaxing the separate production runner.
Runtime env-file overrides are applied before the final command, which must
force production mode before invoking the standalone server.
The Compose checks parse the real service blocks and assert Postgres, web,
and MinIO publish only on host loopback, while Postgres and MinIO credentials
remain configurable with local-only defaults.

## Verification

- 2026-10-03: The regression failed before the final-stage default changed and
  now passes. It does not build images, contact providers, or read operator env
  files.
- 2026-10-07: The Compose guard failed before loopback bindings and credential
  overrides were added; focused `vitest run tests/container-security.test.ts`
  now passes. Structural checks do not need a running Docker engine or read an
  operator `.env` file.
