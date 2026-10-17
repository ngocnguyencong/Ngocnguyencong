# supastack

join our discord: https://discord.gg/sTjKKg2BBt

A modular Web + Mobile + Desktop foundation for AI SaaS products: Next.js web app, Expo
mobile app, Tauri desktop shell, and shared TypeScript packages for auth, billing, AI, jobs, email,
storage, and observability. The public site ships a neutral landing page
composed from the kit block library (`apps/web/src/kit/blocks`) — restyle it
with the theme packs and design styles, or replace it with your own product's
marketing.

The Expo app is a starter surface for native auth and reference flows; most
implemented functionality lives in the web API and shared packages. See
[adopting selected patterns](./docs/adopt-patterns.md) if you already have an
app, or [upgrading between revisions](./docs/upgrading.md) if you maintain a
fork.

AI coding agents: read [llms.txt](./llms.txt) first — it maps the docs, prompts, and security
protocols; [AGENTS.md](./AGENTS.md) holds the boundaries, and
[prompts/agent-setup.md](./prompts/agent-setup.md) is the paste-first setup + deploy prompt.

## Your first local Web run

Use a Windows, macOS or Linux computer. Install [Node.js LTS 22 or newer](https://nodejs.org/en/download),
[Git](https://git-scm.com/downloads/) and a text editor such as
[Visual Studio Code](https://code.visualstudio.com/download). Accept the GitHub invitation
for your purchased repository, open its green **Code → HTTPS** menu and copy the clone URL.
In a terminal in your projects folder, run `git clone YOUR_COPIED_HTTPS_ADDRESS supastack`,
replacing the address with the one you copied, then run `cd supastack`.

Open that `supastack` folder in the editor and choose **Terminal → New Terminal**.
The folder containing `package.json`, `apps` and `packages` is the **repository root**.
Run every command below there, one line at a time. Terminal commands belong in the terminal;
environment settings belong in the named configuration file.

Check `node --version`, `git --version` and `corepack --version`. If Corepack is missing,
run `npm install --global corepack`, reopen the terminal and retry. If PowerShell blocks
`corepack.ps1`, use `corepack.cmd` for the command instead of changing execution policy.

For a guided run, use `corepack pnpm setup` (or `node scripts/setup.mjs`) from the
repository root. The wizard checks Node.js, Corepack and the pinned package manager,
creates `.env` and `apps/web/.env.local` with generated secrets, offers to install
dependencies and run the database migrations, then prints the launch command. In a
non-interactive shell it takes only safe defaults — `--check` validates without writing
and `--yes` accepts defaults. The manual steps below do the same thing one command at a time.

Create the local configuration and download the libraries. Run **only the block for your OS**.
If `.env` or `apps/web/.env.local` already exists, skip its copy command and keep your settings.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item .env.example apps/web/.env.local
corepack pnpm install
```

macOS / Linux:

```bash
cp .env.example .env
cp .env.example apps/web/.env.local
corepack pnpm install
```

If Corepack asks to download the pinned package manager, answer `y`. Wait for installation
to finish, then start the Web app:

```bash
corepack pnpm --filter @supastack/web dev
```

Leave that terminal open. When it shows **Ready**, open [the homepage](http://localhost:3000)
in your browser, then [the local demonstration](http://localhost:3000/ai).
Keep the prefilled name/email and click **Start local reference flow**. Open **AI task**,
click **Queue local task**, then **Run local task** and **View result**. A completed result
confirms the fake AI flow works. This in-memory demo needs no database or paid provider keys;
restarting the server clears its data.

Real sign-up at `/auth`, phone sign-in and saved workspace data require Postgres and
migrations. Follow [Database and migrations](http://localhost:3000/docs/web/database) before
testing those flows. `EMAIL_PROVIDER=local` keeps sign-in messages in the development
[`/mail-preview` outbox](http://localhost:3000/mail-preview), not your external inbox.

The Web server reads **`apps/web/.env.local`**, Expo reads **`apps/mobile/.env.local`**,
and database migration commands read **root `.env`**. Changing only root `.env` does
not configure Web or Expo. Save your changes, then stop the relevant server with
**Ctrl + C** and start it again. Use a second terminal for commands while a server is running.

Once Web is running, follow the detailed tutorials:

- [Tool installation and repository access](http://localhost:3000/docs/web/before-you-start)
- [Commands, files and configuration](http://localhost:3000/docs/web/terminal-basics)
- [Web first run](http://localhost:3000/docs/web/local-setup)
- [Mobile first run](http://localhost:3000/docs/mobile/local-setup) — phone-reachable API address and Expo preview
- [Desktop first run](http://localhost:3000/docs/desktop/local-setup) — Rust, OS build tools and the running Web backend

A Mobile-only or Desktop-only repository does not include the Web server. Use a separately
running backend for those clients; the monorepo includes all three apps.

The desktop shell includes window management, a system tray, a global summon
hotkey, single-instance behavior, `supastack://` deep links, native menus, and a
branded fallback page when the app is unreachable. Release concerns — code
signing and notarization, auto-updates, launch-at-login — are left to your
release pipeline. `corepack pnpm --filter @supastack/desktop check:release-config`
checks the configured bundle identifier and that `SUPASTACK_APP_URL` points at a
public HTTPS origin before a release build.

## Optional checks and all-workspace development

On Windows PowerShell, prepare Corepack's pnpm shim in a user-writable folder
before running the workflow. This needs no elevated shell or global pnpm
install:

```powershell
$shimDir = Join-Path $env:LOCALAPPDATA "supastack\corepack-shims"
New-Item -ItemType Directory -Path $shimDir -Force | Out-Null
corepack enable --install-directory $shimDir
$env:PATH = "$shimDir;$env:PATH"
```

For the monorepo, `corepack pnpm dev` starts all available development workspaces
except Desktop. The filtered Web command above is the simplest first run and also works
in the Web-only repository. On macOS/Linux run `corepack enable` before using Turbo;
if it reports a permission error, keep using the filtered Web command.

The repo is pnpm-managed (`packageManager: pnpm@11.19.0`). Root scripts invoke
Corepack explicitly, but Turbo also resolves `pnpm` by name when it runs
workspace tasks. The PowerShell step makes Corepack's shim discoverable for the
current shell; repeat the `PATH` line in a new shell or add that folder to your
user `PATH`. Corepack itself must be available on `PATH`. Running `corepack
enable` without `--install-directory` can try to write beside `node.exe` under
`Program Files` and require elevation.

`corepack pnpm verify:local` runs the complete credential-free acceptance gate,
including the browser golden path — without the desktop shell, so no Rust
toolchain is needed. PR tests use fake/local adapters and never call billable
providers. `corepack pnpm check` remains the full CI gate (its typecheck step
includes `cargo check` for `apps/desktop`); `corepack pnpm verify:desktop`
covers desktop and needs Rust plus the Tauri prerequisites.

When `apps/docs` is present, monorepo `corepack pnpm dev` also starts its separate
setup site on [port 3001](http://localhost:3001). The complete public docs are part of
Web at [port 3000 `/docs`](http://localhost:3000/docs).

Both browser-test scripts install Playwright's pinned Chromium automatically;
Google Chrome is optional. Set `PLAYWRIGHT_BROWSER_CHANNEL` only to test an
explicitly installed alternative browser. The local gate resets the Web cache
between browser suites, and each Next app generates its types before typechecking.
Windows unit tests and local browser tests use four workers to keep cold-start
resource use bounded.
Browser setup warms each documentation route module once per locale, plus all
other public page modules, before running the navigation checks.

Optional local services run via Docker:

```bash
docker compose up -d postgres
corepack pnpm --filter @supastack/db db:migrate
```

The default `DATABASE_URL` in `.env.example` already matches the compose
credentials, so no env edits are needed. MinIO (`--profile storage`) and a
containerized build of the app (`--profile app`) are optional extras.

### Windows notes

- `.gitattributes` pins `eol=lf`, so checkouts are LF regardless of `core.autocrlf` and
  `corepack pnpm format:check` stays green on a default Git for Windows install.
- If `corepack pnpm build` warns about long link names, enable `git config core.longpaths true`
  and Windows long-path support (Group Policy → "Enable Win32 long paths").
- `corepack pnpm build` defaults to read-only Turbo cache on Windows to avoid
  hanging after the success summary. Cache reads remain enabled; Linux/macOS
  keep normal caching. Explicit `TURBO_CACHE` or `--cache` choices override the
  default (for example, `$env:TURBO_CACHE = "local:rw"` enables local writes).
- Docker Desktop requires WSL 2. Check the prerequisites with `wsl --status`,
  `docker version` (must list a Server section), and `docker compose version`.
  If WSL is missing entirely, run `wsl --install --no-distribution` and reboot.
- If the first Playwright run times out while Windows Defender scans newly
  installed browser binaries, let installation finish and rerun the failed
  suite with `corepack pnpm test:e2e` or `corepack pnpm test:e2e:production`. For a repeat
  failure, inspect the test trace and Defender Protection History before
  increasing timeouts; leave system-wide protection enabled.
- The local browser suite owns port 3100. If another app uses it, set
  `PLAYWRIGHT_PORT` to a free port before running `corepack pnpm test:e2e`; the runner
  will not attach to an unrelated local server.

The explicitly opted-in real-provider acceptance path is documented in
[`docs/real-provider-smoke.md`](./docs/real-provider-smoke.md). `corepack pnpm smoke:providers` is never part
of PR CI and refuses to run unless real AI, transactional email, Stripe sandbox configuration, and
`RUN_REAL_PROVIDER_SMOKE=true` are present.

The durable Trigger.dev + capability-aware router path is documented separately in
[`docs/production-ai-runtime.md`](./docs/production-ai-runtime.md). It requires migrated Postgres,
an immutable model/price catalog, a workspace AI policy, and server-only provider secrets.

## License

Use of this codebase is governed by the terms in [LICENSE.md](./LICENSE.md).
In short: your license lets you build, ship, and sell unlimited end products —
the codebase itself can't be redistributed, repackaged, or published in a
public repository. Each developer with codebase access needs their own seat;
the users of products you ship never count as seats.
