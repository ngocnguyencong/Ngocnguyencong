# apps/web/src/verified-signup-actions.ts

Next.js server-action boundary for the OTP-first signup password. The action
is disabled under the Auth.js engine, reads the Better Auth session from
request headers, and delegates to `verified-signup.ts`; Better Auth's
server-only `setPassword` still enforces its own session and account rules.
It never logs or returns the password and does not expose the Better Auth
method as a browser endpoint.
