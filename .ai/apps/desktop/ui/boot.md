# apps/desktop/ui/boot.js

> Last updated: 2026-10-02 | Protection: STANDARD

## Purpose

Boot-page script for `ui/index.html` — resolves the target app URL, probes
reachability, then redirects into the hosted app or renders the branded
"can't reach" state.

## What It Does

- Target contract: `window.__SUPASTACK_APP_URL__` (injected by the shell's
  initialization script) wins, then the `?target=` query param, then none.
- Probes `fetch(target, { mode: "no-cors", cache: "no-store" })` under a ~10s
  `setTimeout`/`AbortController` timeout; a `settled` flag + `probing`
  re-entrancy guard prevent duplicate resolves/probes.
- On success: `location.replace(target)` (no history entry). On failure:
  "Can't reach {host}" + explanation + Retry; `online` event re-runs it.
- Deliberately ES5-style (var/function) to match `OFFLINE_BANNER_SCRIPT` —
  it runs before any app bundle loads.

## Important Notes / NEVER Change

- 2026-10-03: Browser globals are declared for ESLint and unused catch bindings are omitted. Boot behavior is unchanged; syntax and scoped lint pass.

- Insert target/host text via `textContent` only — never `innerHTML`.
- No framework, imports, or external dependencies; stays a plain script.
- `pnpm test` runs `node --check ui/boot.js` — keep it parseable as a
  classic script (no import/export).

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-02 | Extracted from `index.html` inline script so it is syntax-checked by tests and CSP-safe | Devin |
