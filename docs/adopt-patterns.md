# Adopt patterns without migrating your stack

You can use supastack as a reference while keeping an existing Next.js, Express,
Capacitor, or other application. Pick one complete capability and adapt its
boundaries to your app. Copying a package directory alone will usually miss the
schema, configuration, server caller, and tests that make it safe.

## Choose one vertical slice

Start with the user outcome, then trace the code that enforces it. For a paid
article or report, the slice is:

1. A trusted billing event or admin action grants an entitlement to a workspace.
2. The server resolves the reader's authenticated workspace and its current
   entitlements.
3. The content query returns a full body only when that workspace has the
   required entitlement. Locked items can still return a title and teaser.
4. The client renders the allowed body or an upgrade prompt. It never makes the
   final access decision.

In this repo, inspect `packages/billing`, `packages/db/src/schema.ts`,
`apps/web/src/entitlement-check.ts`, `apps/web/src/content-access.ts`, and
`apps/web/src/content-queries.ts` together. The CMS gate is
`required_entitlement`; its value must match the entitlement key your plan
grants. `apps/web/src/kit/blocks/app/paywall-gate.tsx` is presentation only.

If your existing app already has licenses, keep that store and map verified
license state to a workspace entitlement. A license key shown in a client is
not itself a server-side authorization decision.

## Map contracts before copying code

Write down your equivalents for the following:

| Supastack boundary                | Existing-app equivalent                                 |
| --------------------------------- | ------------------------------------------------------- |
| `workspaceId`                     | Tenant or account id derived from the server session    |
| Entitlement key and active status | Plan, license, or feature-grant record                  |
| Signed billing webhook            | Existing gateway event receiver and replay guard        |
| Protected content query           | Server route or function that removes locked body data  |
| Transactional email and jobs      | Existing sender and scheduler, if your slice needs them |

Preserve the rules even if you change the implementation: every user-owned row
has a tenant scope; provider secrets remain server-only; webhook signatures
are verified before changing access; duplicate or stale events do not regrant
access. Never accept a tenant id sent by the client as proof of ownership.

## Adapt to a Capacitor client

Keep the entitlement decision in your server. Expose a small authenticated
endpoint that returns the viewer's access state and the permitted content
projection. A Capacitor screen can use that response to show a report or a
locked teaser. `apps/mobile/src/entitlements/client.ts` and
`presentation.ts` show the separation between fetching access state and
displaying it, though their Expo-specific pieces need adaptation for
Capacitor.

Native purchases need a purchase integration and store-policy review specific
to your app. The included mobile app intentionally does not expose Stripe
Checkout before a native purchase integration exists.

## Port and verify in a safe order

1. Add the tenant and entitlement schema changes to a disposable database.
   Translate Drizzle migrations if your app uses another ORM.
2. Port the server entitlement check and one protected content read. Test an
   entitled workspace, an unentitled workspace, an anonymous reader, and an
   attempted cross-workspace read. Assert that locked responses contain no
   protected body data.
3. Connect your existing payment or license source through a verified,
   idempotent event path. Test invalid signatures, replay, cancellation, and
   out-of-order events.
4. Add the client state and upgrade prompt after server enforcement works.
   Test loading and error states separately from access denied.
5. Record the supastack source commit and each adaptation you made. Use
   [Upgrading](./upgrading.md) to compare later revisions.

Run your existing app's tests plus the relevant supastack unit tests as a
reference. A passing UI fixture is not evidence that live payment events or
native purchase callbacks work; verify those separately in a sandbox.
