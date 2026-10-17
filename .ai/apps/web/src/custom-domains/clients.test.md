# apps/web/src/custom-domains/clients.test.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Offline tests for both provider clients with a stubbed `fetch`: request
shape (zone path, ssl body, auth header), status/validation-record
mapping, error surfacing, and the local client's immediate-active
behavior.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Initial tests (phase B3) | Devin |
