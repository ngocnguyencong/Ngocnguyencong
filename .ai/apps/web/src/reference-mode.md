# apps/web/src/reference-mode.ts

## Purpose

Selects fake local reference UI or production dashboard behavior from
application environment and configured providers.

## Security Fix (2026-09-27)

A production build always selects production reference mode even if local/test provider configuration is supplied.
