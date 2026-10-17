# apps/web/package.json

> Last updated: 2026-09-21 | Protection: STANDARD

## Purpose

`@supastack/web` — the Next.js product app. Depends on all `@supastack/*`
workspace packages plus direct runtime deps (next, react, auth, billing,
email, AI SDKs).

## Important Notes

- Fresh-checkout repair: `typecheck` runs `next typegen` before tsc;
  generated Next files are ignored and no longer tracked.

- 2026-09-29: pinned MIT `motion@12.23.26` added for reuse by buyer product surfaces. This is dependency availability only; supastack remains a buyer-clean foundation.

- Runtime deps use pinned versions; shared libs (react, typescript, zod)
  come from the root `catalog:`.
- `dev`/`start` are pinned to `--port 3000` (2026-09-22) — docs owns 3001;
  explicit ports fail loudly on collision in Next 16.3.4 instead of silently
  falling back. The Dockerfile runs `node apps/web/server.js`, so `start` is
  dev-only.
- `firebase-admin@13.6.0` (added 2026-09-21) powers the Firestore
  marketing lead store (`MARKETING_LEAD_STORE=firestore`); it is
  dynamic-imported inside `lead-store.ts`, so it never loads unless that
  provider is selected.
- `jsdom` devDependency (added 2026-09-23) — first DOM-capable test
  environment, used by `src/kit/blocks/app/otp-input.test.tsx` via
  `// @vitest-environment jsdom`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-03 | `license` field added (`SEE LICENSE IN LICENSE.md`) | Devin |
| 2026-09-23 | Added jsdom devDependency for DOM-level component tests | Devin |
| 2026-09-21 | Added firebase-admin for the Firestore lead store | Devin |
| 2026-09-22 | dev/start pinned to --port 3000 | Devin |

Release repair: Next.js is pinned to the patched 16.3.8 release, and the direct MCP SDK pin is 1.31.0. Full local lint, all workspace typechecks, unit tests, and formatting passed; remote build/browser validation runs in CI.
