# github-auth-setup.md

> Last updated: 2026-10-06 | Protection: CRITICAL

## Purpose

Operator setup guide for identity-only GitHub OAuth in local and production environments.

## Security Invariants

- OAuth client secrets stay in ignored env files or a production secret manager.
- Sign-in and account linking are identity-only — repository access stays
  outside this template's identity flow; do not request broad repository
  scopes.

## Change History

| Date       | Change                                                                                                       | Author |
| ---------- | ------------------------------------------------------------------------------------------------------------ | ------ |
| 2026-10-06 | Removed the GitHub App env-var tail section (machinery outside this repository); guide ends after the secret rule | Devin  |
