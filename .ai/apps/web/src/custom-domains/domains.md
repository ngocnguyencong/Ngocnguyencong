# apps/web/src/custom-domains/domains.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Pure lifecycle rules shared by the domain server actions:
`MAX_DOMAINS_PER_WORKSPACE` (5), `canAddDomain`, and
`applyRemoteHostnameStatus` which maps a fresh provider read onto the
stored row and flags `newlyVerified` only on a non-active → active
transition (the moment the `domain.verified` webhook fires).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Initial rules (phase B3) | Devin |
