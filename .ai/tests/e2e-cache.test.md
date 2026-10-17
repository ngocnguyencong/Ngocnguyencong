# tests/e2e-cache.test.ts

## Purpose

Run the cache reset helper inside a real temporary checkout to prove it removes
only the Web cache, survives a second invocation and ignores the caller's cwd.
