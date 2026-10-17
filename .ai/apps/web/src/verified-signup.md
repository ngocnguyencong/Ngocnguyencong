# apps/web/src/verified-signup.ts

Pure password-creation gate for the OTP-first Better Auth signup flow. It
validates password bounds and requires an authenticated, verified, non-banned
Better Auth user before calling the injected password setter. This keeps
security behavior testable without loading Next.js, a database, or providers.

The matching unit tests exercise no-session, unverified, banned, invalid
password, successful verified session, and setter-error cases.
