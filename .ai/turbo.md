# turbo.json

Turborepo pipeline wiring for `build`, `dev`, `typecheck`, and `test` across
the workspace. Shipped verbatim to every platform checkout.

## Important Notes

- Turbo's default strict env mode only forwards variables named in
  `globalEnv`/`globalPassThroughEnv` (plus its built-in safelist) to task
  processes. `globalEnv` includes `APP_ENV`: it must reach `next build`,
  because the config schema maps a bare `NODE_ENV=production` build to
  `APP_ENV=production` and then requires the full production env set. Without
  the entry, an exported `APP_ENV` (for example `test` in CI) is silently
  stripped and the web build fails config validation during page-data
  collection. `APP_ENV` belongs to `globalEnv`, not `globalPassThroughEnv`,
  because it changes build output and must stay part of the task hash.
- `globalPassThroughEnv` covers non-hash-relevant flags (`CI`, Expo
  telemetry/offline switches) that tasks should observe without busting cache.
- Other provider/config variables intentionally stay filtered: the documented
  setup flow supplies them through `.env` / `apps/web/.env.local`, which
  Next.js loads directly from the app directory regardless of task env
  filtering.
