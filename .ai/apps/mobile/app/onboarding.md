# app/onboarding.tsx

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

First-run wizard mirroring the web onboarding (profile → workspace →
plan → done): optional org-name creation, then marks
`POST /api/onboarding/state {step:"done"}` and lands on `/home`.
Skipping keeps the personal workspace.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Created | Devin |
