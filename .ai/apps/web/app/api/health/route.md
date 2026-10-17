# apps/web/app/api/health/route.ts

## Purpose

Public JSON health probe for database connectivity and provider kinds.

## Security Fix (2026-09-27)

The health route obtains its snapshot from the shared server-only probe and keeps the existing 200/503 response status.
