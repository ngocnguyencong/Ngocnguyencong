# scripts/setup.mjs

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

Interactive guided setup (`pnpm setup`, or `node scripts/setup.mjs` when pnpm
is not on PATH yet) that walks a fresh checkout from clone to running:
preflight → env bootstrap → optional dependency install → optional database
migrations → next-steps summary. Node built-ins only; shipped with the web
backend checkout alongside `setup-env.mjs`.

## Contract

- Preflight reads the checkout's own `package.json`: `engines.node` floor
  (first `>=X.Y.Z` triple compared numerically), `packageManager` pin,
  `corepack --version` probe, `node_modules` presence (interactive runs offer
  `corepack pnpm install`, default yes).
- Environment step delegates to `setupEnvironment` from `./setup-env.mjs`:
  a passing `--check` probe means "already valid, skip"; otherwise the real
  bootstrap runs and reports changed file names only — existing valid values
  are always preserved and no secret value is ever printed. A thrown error
  gets a remedy matched to its kind (`envSetupRemedy`): checkout-layout
  problems (missing `.env.example`, non-directory root) point back at the
  repository root; value/key conflicts and unsafe env paths keep the
  preserved-values, fix-the-named-file-or-key guidance.
- Migration step asks (default no — Postgres may not be up) before running
  `corepack pnpm --filter @supastack/db db:migrate`; a failure exits 1 with
  the `docker compose up -d postgres` remediation. `--skip-migrate`, missing
  dependencies, and non-interactive mode all skip it with a hint line.
- Finish prints the `corepack pnpm --filter @supastack/web dev` command, the
  localhost URL (in-memory demo needs no database), and the docs pointers.
- Flags: `--help`, `--check` plus its no-write alias (validate tools and
  env, write nothing, collect every check's status before exiting — the
  trailing `FAIL: N checks failed` summary goes to stderr with the other
  FAIL lines),
  `-y`/`--yes`/`--non-interactive` (env bootstrap only — no installs, no migrations),
  `--skip-migrate`. Non-TTY stdin behaves as `--yes` with a logged line;
  prompts show defaults as `[Y/n]`/`[y/N]` via `node:readline/promises`.
- Prompt EOF (`rl.question` resolving `null`, or the readline `close` event
  on older Node — raced with `node:events` `once`) surfaces as the exported
  `INPUT_ENDED` sentinel: the wizard prints `FAIL: input ended mid-prompt —
  setup aborted.` and exits 1 rather than swallowing the question's
  fallback — the install prompt's `true` default must never auto-fire.
  `normalizeAnswer` itself tolerates non-string input by returning the
  fallback, but callers intercept `null` before reaching it.
- Child commands are fixed-literal, `Object.freeze`d `corepack pnpm …` argv,
  never bare `pnpm`. Windows joins them into one `shell: true` command
  string (the `.cmd` shim needs cmd.exe) while POSIX spawns argv directly;
  `COREPACK_ENABLE_DOWNLOAD_PROMPT` defaults to `0` for children.
- Exports for isolated tests: `INPUT_ENDED`, `parseFlags`, `resolveMode`,
  `satisfiesNodeRange`, `normalizeAnswer`, and `runWizard(root, {mode,
  skipMigrate}, io)` where `io` injects print/fail/probe/run/ask — `ask`
  resolves `boolean | INPUT_ENDED`.
- Exit 0 ok; 1 on a failed step, always with a remediation line. Never
  installs system tools, never modifies git config, never prints secrets.

## Decisions

- `setup` is not part of the shared kept-script list: only the web backend
  checkout carries the script (the env bootstrap targets `apps/web`), so its
  generated `package.json` gains `pnpm setup` through a declared per-repo
  script override rather than the common set.
- `--check` accumulates failures across all checks before exiting 1; normal
  mode fails fast at the first broken step since remediation is ordered.
- EOF is an abort, not an answer: coercing `null` to a fallback would let
  Ctrl+D silently accept the `true`-defaulted install prompt, so the
  sentinel round-trips through `io.ask` and `runWizard` returns the failure
  itself — keeps exit-code semantics intact for injected-io tests.
- A missing `corepack` is fatal in normal mode — every later step is a
  `corepack pnpm` invocation — and a `FAIL` line in check mode.
- pnpm resolves `pnpm setup` to the project script under the pinned pnpm 11;
  flags reach the script through pnpm's `--` separator
  (`corepack pnpm setup -- --check`).

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | Next-steps output += `http://localhost:3000/setup` in-app checklist pointer | Devin |

## Verification

- `tests/setup.test.ts` (24 cases): flag/mode/answer parsing (incl.
  non-string `normalizeAnswer` input), engines-range comparison,
  injected-io wizard flows (install accept, migrate failure remediation,
  non-interactive defaults, `--skip-migrate`, corepack outage, check-mode
  accumulation, EOF aborts at both prompts, remedy-by-kind for missing
  `.env.example` vs invalid key), and spawned CLI runs on fixture checkouts
  (`--help`, unknown flags, `--check`, non-TTY defaults, `--yes`, engines
  rejection, invalid-secret failure without value disclosure — the spawned
  describe carries an explicit 30s timeout for Windows CI).
- Live in this checkout: `node scripts/setup.mjs --check` and
  `corepack pnpm setup -- --check` report preflight PASS lines and flag the
  deliberately absent `apps/web/.env.local` without writing anything.
