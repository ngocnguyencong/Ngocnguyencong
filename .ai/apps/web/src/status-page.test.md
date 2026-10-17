# apps/web/src/status-page.test.tsx

## Purpose

Regression test that public status rendering does not make an outbound
request based on inbound Host or forwarded protocol headers.

## Security Fix (2026-09-27)

Tests supply hostile Host and forwarded protocol headers and assert the status page calls the health probe without any fetch.
