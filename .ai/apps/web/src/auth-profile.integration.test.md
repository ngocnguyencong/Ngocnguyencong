# auth-profile.integration.test.ts

## Purpose

Optional Postgres integration coverage for auth profile persistence and isolated personal workspaces.

## Decisions

- Capture email OTPs and consume them before account creation. TEST_AUTH_DATABASE_URL remains required; never run against an implicitly configured provider database.
- Supply an explicit admission allow stub so this optional integration stays
  focused on profile persistence and workspace isolation.
