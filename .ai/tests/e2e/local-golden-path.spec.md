# tests/e2e/local-golden-path.spec.ts

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

Chromium acceptance for the credential-free local reference flow at `/ai`:
hydration/authentication failure surfacing plus the golden path — local flow
sign-in, AI task queue → run → result, transactional outbox note, and state
persistence across reload.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-13 | Navigations retargeted to `/ai` after the console moved off `/dashboard` | Devin |
