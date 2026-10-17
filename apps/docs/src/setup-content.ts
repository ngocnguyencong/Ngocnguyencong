export const setupGuidance = {
  local: {
    requiresCredentials: false,
    steps: [
      "Install Node.js 22 or newer, Git and a text editor. Accept your repository invitation and clone the kit. Open its top-level folder in the editor; package.json and the apps folder should appear there. Choose Terminal → New Terminal. Run the following commands from that repository root, not from apps/docs.",
      "Create the Web configuration before launching. In Windows PowerShell run Copy-Item .env.example .env, then Copy-Item .env.example apps/web/.env.local. In macOS/Linux run cp .env.example .env, then cp .env.example apps/web/.env.local. Run only your operating system's commands. If a destination file already exists, keep it and skip its copy line. Next.js reads apps/web/.env.local; root .env is used by database migrations.",
      "Run corepack pnpm install and wait for it to finish. If Corepack asks to download the pinned pnpm version, answer y. If corepack is missing, install it with npm install --global corepack, reopen the terminal and retry. The checkout pins pnpm in package.json; do not change that pin to follow another tutorial.",
      "Run corepack pnpm --filter @supastack/web dev. Leave this terminal open and wait for Ready and http://localhost:3000. Put http://localhost:3000/ai into the browser address bar. Keep the prefilled name/email and click Start local reference flow; open AI task, click Queue local task, then Run local task and View result. A completed result confirms the in-memory demonstration works without Postgres or paid provider keys.",
      "Real sign-up at /auth and phone sign-in require Postgres and migrations; the AI task demonstration does not create a persistent account. Continue at http://localhost:3000/docs/web/database. With local email, messages appear at /mail-preview instead of an external inbox. The Web docs include separate Mobile and Desktop tutorials; those clients need a running backend.",
      "To stop the server, select its terminal and press Ctrl + C. Restart using the same Web command; you do not reinstall libraries each time. If port 3000 is already in use, stop the other development server first. The complete first-run walkthrough and troubleshooting live at http://localhost:3000/docs/web/local-setup and /docs/web/terminal-basics.",
      "Optional after the first run: corepack pnpm test runs automated checks. In the monorepo, corepack pnpm verify:local runs the longer build and browser acceptance gate without Rust; it is not required before viewing the first page. Native Desktop builds need separate Rust and OS prerequisites.",
    ],
    title: "Local fake-adapter quickstart",
  },
  agent: {
    requiresCredentials: false,
    runbook: "docs/agent-setup.md",
    steps: [
      "Read llms.txt at the repository root for the repo map, then AGENTS.md for the non-negotiable boundaries, then execute docs/agent-setup.md literally — step order, verbatim commands, verification checkpoints.",
      "Bootstrap env only from .env.example — copy it to root .env and apps/web/.env.local, and replace every replace-with-* placeholder with generated secrets (openssl rand -hex 32 for AUTH_SECRET/SCHEDULER_TICK_SECRET, openssl rand -base64 32 for CREDENTIAL_ENCRYPTION_KEY).",
      "Pick a local path: containerized dev via docker compose -f docker-compose.dev.yml up -d (or the podman compose equivalent) plus the migrate profile, or the host path corepack pnpm install + corepack pnpm --filter @supastack/web dev with Postgres from docker compose up -d postgres or a managed DATABASE_URL.",
      "Pick a deploy target when needed: Coolify per docs/vps-coolify.md, or a plain VPS with the docker compose app profile behind Caddy — the production image serves port 8080 and needs the APP_ENV=production env set.",
      "Verify with the checkpoints in docs/agent-setup.md: GET /api/health returns status ok, a real sign-in and workspace isolation after migrations, and a scheduler tick via pnpm jobs:tick or the x-scheduler-key POST.",
    ],
    title: "AI agent setup path",
  },
  providers: {
    command: "pnpm smoke:providers",
    prerequisites: [
      "A Stripe sandbox account and webhook signing secret.",
      "At least one supported AI provider API key.",
      "A Resend or SES transactional-email account and verified sending domain.",
      "OAuth app credentials for any real Google or Apple sign-in smoke test.",
    ],
    requiresCredentials: true,
    runbook: "docs/real-provider-smoke.md",
    title: "Real-provider smoke path",
  },
} as const;
