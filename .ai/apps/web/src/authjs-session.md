# apps/web/src/authjs-session.ts

## Purpose

Decode signed, versioned Auth.js session cookies into the local user identity
used by the app. `resolveAuthJsSessionIdentity` then loads current verification
and ban state instead of trusting the JWT alone.

## Security Fix (2026-09-27)

Only accept session tokens minted by the provider-account linking flow. Older
email-derived identity tokens are rejected, including by the direct BFF
decoder. The active-identity gate rejects missing, unverified, and banned
accounts on every app-session read.

`provider-account-v2` rejects tokens minted before verified credentials became
mandatory, preventing old JWT revival after an auth-engine switch. JWT and
session callbacks also reread the current role, verification and ban state.
