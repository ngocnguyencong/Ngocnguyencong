# admin-bootstrap.test.ts

## Purpose

Test admin plugin composition and verified ADMIN_EMAILS bootstrap.

## Decisions

- A matching email is insufficient: the created identity must have emailVerified true. The real-handler security suite covers false, pending and legacy session cases.
- Supply an explicit allow stub for required pre-persistence mail admission in
  all composition fixtures; keep the admin bootstrap assertions unchanged.
