# domain-actions.test.ts

## Purpose

Exercise real domain creation actions with a controlled repository and provider.
Only the exact workspace advisory-lock query acquires serialization, so removing
the lock or moving the count before it makes the parallel quota regression fail.
Parallel distinct hostnames must respect the workspace quota before provider
creation. Authorization, ordinary creation and provider failure remain covered
without live database or Cloudflare calls.
