# apps/web/src/db-errors.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Shared Postgres error detectors for server actions — Postgres surfaces
SQLSTATE on the driver's `code` property.

## What It Does

- `isUniqueViolation(error)` — true when the driver error carries
  `code === "23505"` (unique_violation). Used to map constraint hits into
  domain outcomes (e.g. idempotent upserts) instead of 500s.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
