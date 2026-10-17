# scripts/reset-e2e-cache.mjs

## Purpose

Reset only this checkout's `apps/web/.next` between browser suites, matching the
existing Linux CI mitigation for Turbopack graph-resumption panics.

## Behavior

Resolve the fixed target relative to the script, use bounded removal retries for
Windows file locks, tolerate an absent cache and propagate removal errors. Never
remove a sibling app's cache or depend on the caller's current directory.
