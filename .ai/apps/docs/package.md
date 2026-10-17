# apps/docs/package.json

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

`@supastack/docs` — the Next.js documentation site. `typecheck` runs
`next typegen && tsc -p tsconfig.json --noEmit`, generating ignored Next files
before a cold-checkout check.

## Important Notes

- Fresh-checkout repair: generate Next environment and route types before
  tsc instead of shipping the generated `next-env.d.ts` file.

- `dev`/`start` are pinned to `--port 3001` (2026-09-22) so it never steals
  3000 from the web app; explicit ports fail loudly on collision in
  Next 16.3.4 instead of silently falling back.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-03 | `license` field added (`SEE LICENSE IN LICENSE.md`) | Devin |
| 2026-09-22 | dev/start pinned to --port 3001 | Devin |

Release repair: the docs app uses the same patched Next.js 16.3.8 version as web; all workspace typechecks passed.
