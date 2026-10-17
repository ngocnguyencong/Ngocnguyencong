# apps/web/src/verified-signup-actions.test.ts

Pins the Next.js boundary: Auth.js mode and missing/unverified/banned Better
Auth sessions cannot call `setPassword`; an authenticated verified session
can, and internal failures are returned without their raw message.

Result (2026-10-04): Existing unused mock-argument lint failures are resolved
without weakening the verified-session boundary assertions.
