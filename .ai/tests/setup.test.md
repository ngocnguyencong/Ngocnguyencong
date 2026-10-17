# tests/setup.test.ts

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

Test the guided setup wizard against disposable fixture checkouts, never
operator files. Twenty-four cases cover flag and mode parsing, engines-range
and prompt-answer helpers (including non-string `normalizeAnswer` input),
injected-io wizard flows (interactive install/migrate, non-interactive
defaults, `--skip-migrate`, corepack outage, check-mode failure
accumulation, `INPUT_ENDED` aborts at both prompts — never coerced to the
prompt's `true` fallback — and env-error remedy selection: missing
`.env.example` → repository-root remedy, invalid key → named-file-or-key
remedy), and spawned CLI runs (`--help`, unknown flags, `--check`, non-TTY
defaults, `--yes`, engines rejection, invalid-secret failure that names the
key but never the value).

## Verification

- Fixtures carry `.env.example`, a minimal `package.json` (engines +
  packageManager pin) and optional env contents under a temp dir; spawned
  runs pipe stdin so the non-TTY defaults path is exercised for real.
- `runWizard` is tested with an injected `io` (print/fail/probe/run/ask) so
  interactive branches run without a TTY and `corepack pnpm` calls are
  recorded, not executed; `ask` can return `INPUT_ENDED` to drive the
  EOF-abort branches.
- Host-dependent expectations compute `COREPACK_OK` by probing
  `corepack --version` the same way the script does (joined command string
  through the shell on Windows, 30s spawn timeout), so the suite stays green
  on machines with or without Corepack.
- The spawned-CLI describe carries an explicit 30-second timeout — each case
  boots node → corepack → cmd.exe on Windows and the default 5s flakes on CI.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | Interactive next-steps assertion += the `http://localhost:3000/setup` checklist line | Devin |
