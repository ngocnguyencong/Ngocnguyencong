import type { Guide } from "./content";

function guide(
  slug: string,
  tab: Guide["tab"],
  group: string,
  title: string,
  description: string,
  setup: string[],
  code: string,
  workflow: string[],
  checks: string[],
): Guide {
  const beginner = beginnerGuideNotes[slug];
  const beginnerCommands = beginnerGuideCommands[slug];
  return {
    slug,
    tab,
    group,
    title,
    description,
    sections: [
      {
        id: "setup",
        title: "Setup and configuration",
        paragraphs: beginner ? [beginnerPrerequisite, beginner.setup, ...setup] : setup,
        ...(code ? { code } : {}),
      },
      ...(beginnerCommands
        ? [
            {
              id: "commands",
              title: "Commands to copy",
              paragraphs: [
                "Follow the comments to see which folder a command runs in. If two terminals are labeled, open two terminal windows and keep the first command running while you use the second.",
              ],
              code: beginnerCommands,
            },
          ]
        : []),
      { id: "workflow", title: "Implementation workflow", paragraphs: workflow },
      {
        id: "verification",
        title: "Verification and troubleshooting",
        paragraphs: beginner ? [beginner.troubleshooting, ...checks] : checks,
      },
    ],
  };
}

type BeginnerGuideNotes = {
  setup: string;
  troubleshooting: string;
};

const beginnerPrerequisite =
  "Before any step, read [Before you start](/docs/web/before-you-start) and [Terminal basics](/docs/web/terminal-basics). These instructions assume you opened the full supastack monorepo in VS Code; its root package.json marks the repository root. In pnpm commands, a workspace package is an app or shared-code folder; in the product, a workspace is a team's data container and security boundary. corepack pnpm --filter ... selects one package from the monorepo while commands run from its root. If you opened only a synced mobile or desktop folder, it does not contain the Web backend, Docker setup, or root scripts: run the backend from this monorepo or a reachable hosted server, and use the platform folder's own scripts. An environment variable is a named setting stored in a local .env file or your hosting dashboard; restart the relevant app after changing it, and keep server secrets out of NEXT_PUBLIC_ and EXPO_PUBLIC_ values.";

const beginnerGuideNotes: Readonly<Record<string, BeginnerGuideNotes>> = {
  "web/adopt-patterns": {
    setup:
      "1. In VS Code, open docs/adopt-patterns.md and pick one feature you want to reuse. 2. Open the matching package under packages/ and compare it with the same feature in your own product; make changes on a new branch in your product checkout. 3. From this repository root, run corepack pnpm test to check the reference kit. Expected: you have a short list of the files, database changes, and server routes that feature needs. This is a coding task, not a one-click import.",
    troubleshooting:
      "If the file names or framework do not match your product, pause and adapt one part at a time instead of copying a whole folder. If an access test can read another workspace's data, stop: the server must get workspaceId from the signed-in session and check it on every request.",
  },
  "web/upgrading": {
    setup:
      "1. Open docs/upgrading.md and use your Git app to create a local branch named upgrade/kit-update. 2. In a terminal at the repository root, run git status --short, then git fetch upstream if that remote is already configured; use git remote -v to see configured names. 3. Compare the recorded starting and target commit with git diff --stat <starting-commit>..<target-commit>. Expected: you see the size of the update before combining files. Keep production data and credentials out of this local review.",
    troubleshooting:
      "If Git says upstream is unknown, stop before adding it and check which repository you cloned; this kit has separate web, mobile, desktop, and monorepo sources. If a diff says bad revision, fetch the matching remote and copy the full commit IDs from git log. Keep conflict resolution on the upgrade branch, and back up a database before any migration that changes stored data.",
  },
  "web/project-structure": {
    setup:
      "1. Open the root package.json in VS Code, then browse apps/web for the website, apps/mobile for Expo, apps/desktop for the desktop shell, and packages for shared pieces. 2. From the repository root run corepack pnpm --filter @supastack/web dev. 3. Open http://localhost:3000. Expected: the Web app starts from apps/web while shared packages remain in this same repository; the Desktop window wraps this Web app rather than containing a second product.",
    troubleshooting:
      "If the command reports that no project matches the filter, check that the terminal is in the folder containing the root package.json. If port 3000 is already in use, stop the other local Web server first. Do not look for a separate Desktop chat or login implementation; the desktop shell loads the Web backend.",
  },
  "web/database": {
    setup:
      "1. Install and start Docker Desktop. 2. Copy .env.example to .env in the root for migration tools and to apps/web/.env.local for Next.js (PowerShell: Copy-Item .env.example .env; Copy-Item .env.example apps/web/.env.local. macOS/Linux/Git Bash: cp .env.example .env; cp .env.example apps/web/.env.local). Keep DATABASE_URL the same in both files; the example already matches the local Docker database. 3. From the repository root run docker compose up -d postgres and docker compose ps; wait until postgres reports healthy. 4. Run corepack pnpm --filter @supastack/db db:migrate from the root to apply the migrations already shipped with the kit. Only after editing packages/db/src/schema.ts, run db:generate, inspect the generated SQL, then run db:migrate. Expected: the local Postgres container is healthy and the Web app uses its migrated database. Never point this first run at production.",
    troubleshooting:
      "If Docker says it cannot connect to its engine, start Docker Desktop and wait for it to finish loading. If postgres is not healthy, run docker compose logs postgres from the root and fix that error before migrating. If Web says DATABASE_URL is missing, check apps/web/.env.local; if db:migrate cannot connect, check the root .env. If you change databases, update both files. Read the first failed migration statement before retrying; never repeat it against production.",
  },
  "web/theming": {
    setup:
      "1. In VS Code open apps/web/app/app-theme.css for signed-in product screens and apps/web/src/theme/catalog.ts to add a color pack. Do not edit apps/web/app/theme.css for product colors; it controls the marketing brand. 2. From the repository root run corepack pnpm --filter @supastack/web dev, then visit http://localhost:3000/settings/appearance. 3. Change a token in your local branch and refresh the preview. Expected: the dashboard controls update while the homepage keeps its selected marketing theme.",
    troubleshooting:
      "If a color change affects the marketing homepage, check that you edited app-theme.css and review apps/web/src/theme/marketing-theme.ts. If text becomes hard to read, restore the previous value and run corepack pnpm test -- apps/web/src/theme/contrast.test.ts from the root before trying again.",
  },
  "web/blog-content": {
    setup:
      "1. In VS Code open apps/web/src/resources/content.ts and copy a complete nearby article as your starting point; article copy lives in the repository, not in a publishing dashboard. 2. Give the article a new slug, title, category, date, sections, and an existing guide slug. 3. From the repository root run corepack pnpm --filter @supastack/web dev and open http://localhost:3000/blog/<your-slug>. Expected: the article and its related-guide link load locally before you share the URL.",
    troubleshooting:
      "If the article returns 404, check that its slug is unique and that it was added to the article list in apps/web/src/resources/content.ts. If the table of contents jumps nowhere, give every section a unique id. Run corepack pnpm test -- apps/web/src/resources/content.test.ts from the root to see content validation errors.",
  },
  "web/testing": {
    setup:
      "1. Open the repository-root package.json to see the check commands. 2. From that root folder run corepack pnpm test for automated unit tests, then corepack pnpm --filter @supastack/web typecheck for Web TypeScript checks. 3. For browser behavior, start the Web app and run corepack pnpm test:e2e. Expected: each command reports its own result; a unit test does not prove that a real database, payment provider, email service, or phone works.",
    troubleshooting:
      "If a database test says it was skipped, set up its isolated test database before reporting database coverage. If a Web tab is at port 3001, it is the separate apps/docs server; the kit Web app starts at port 3000. If Playwright fails on its first Windows run, let browser installation finish and rerun the failing command; never turn off system-wide security to work around it.",
  },
  "mobile/authentication": {
    setup:
      "1. Open apps/mobile/src/auth/client.ts and apps/mobile/src/auth/mobile-auth-configuration.ts in VS Code to find the existing sign-in flow. 2. Put EXPO_PUBLIC_API_URL and EXPO_PUBLIC_APP_SCHEME in apps/mobile/.env.local, and make sure the Web server has its own settings in apps/web/.env.local. 3. From the root start Web with corepack pnpm --filter @supastack/web dev, then in another terminal start Expo with corepack pnpm --filter @supastack/mobile start. Expected: a test sign-in opens the browser and returns to the mobile app. On a physical phone, use the computer's reachable Wi-Fi/LAN address for the API; phone-localhost means the phone itself.",
    troubleshooting:
      "If sign-in opens a browser but does not return to the app, check that EXPO_PUBLIC_APP_SCHEME matches the scheme in apps/mobile/app.config.ts. If the app cannot reach the server, replace localhost with the computer's LAN address, confirm both devices use the same network, then restart Expo after editing apps/mobile/.env.local. Expo Go is a UI preview; native purchase acceptance needs an EAS development build.",
  },
  "mobile/builds": {
    setup:
      "1. Open apps/mobile/eas.json and apps/mobile/app.json in VS Code to review development, preview, and production settings. 2. Add the native development client from the repository root with corepack pnpm --filter @supastack/mobile exec expo install expo-dev-client. Run corepack pnpm --filter @supastack/mobile typecheck, then corepack pnpm --filter @supastack/mobile build for the local JavaScript export. 3. For native testing, sign in to your Expo account, change the terminal folder with cd apps/mobile, then run npx eas-cli@latest build --platform android --profile development. Use ios to request an EAS cloud iOS build from any operating system; a Mac with Xcode is needed to run the iOS Simulator or compile locally. Expected: the export verifies the JavaScript bundle and EAS produces an installable native development app. See [Expo's development build guide](https://docs.expo.dev/develop/development-builds/faq/) for why Expo Go cannot add native libraries.",
    troubleshooting:
      "If the EAS build says expo-dev-client is missing, repeat its install command and confirm apps/mobile/package.json now lists it. Run EAS from apps/mobile so it finds eas.json. If EAS reports a missing project or signing setup, check your Expo account and project settings. Expo Go and a successful export still do not test StoreKit or Play Billing; use an EAS development build with sandbox products. A cloud iOS build can be started on Windows or Linux; only local iOS Simulator/build work needs a Mac with Xcode.",
  },
  "modules/ai-configuration": {
    setup:
      "1. Open apps/web/.env.local for the local Web server and apps/web/src/agent-runtime.ts for provider selection; .env.example is the list of supported setting names. 2. Keep AI_PROVIDER=fake for local interface work unless you have your own provider account and want to test real generation; never put provider keys in a NEXT_PUBLIC_ or EXPO_PUBLIC_ setting. 3. Start the Web app from the repository root with corepack pnpm --filter @supastack/web dev. Expected: local screens can be explored without configuring a paid provider; actual generation requires a valid server provider and enabled model choices in the database catalog.",
    troubleshooting:
      "If the app reports that no AI model is available, check the server's AI_PROVIDER, the enabled models and prices in the admin catalog, and the cheap/fast/smart alias policy. If a real provider returns an authentication error, check its key in apps/web/.env.local and restart the server. A key prefixed NEXT_PUBLIC_ would be visible to browsers and must be removed.",
  },
  "modules/task-recovery": {
    setup:
      "1. Open apps/web/src/ai-task-runtime.ts in VS Code and read docs/production-ai-runtime.md before changing task recovery. 2. Use a test workspace you own and save the same idempotency key before submitting a task again. 3. From the repository root run corepack pnpm test -- apps/web/src/ai-task-runtime.test.ts. Expected: a retry with the same key returns the saved task; a different workspace or changed input stays denied instead of creating duplicate work.",
    troubleshooting:
      "If a request timed out, look up its original task and reuse its saved key; do not click a new submission repeatedly. A 409 means the same key was sent with different input. A 401 or 403 means sign in again and check workspace ownership and entitlement before retrying.",
  },
  "modules/jobs": {
    setup:
      "1. Open apps/web/src/job-handlers.ts and apps/web/src/scheduler-runtime.ts in VS Code. A job is background work; the scheduler decides when to enqueue it. 2. For a local tick, set the same SCHEDULER_TICK_SECRET in apps/web/.env.local and the repository-root .env; the tick script reads the root .env, while the Web endpoint reads its app settings. 3. Start Web with corepack pnpm --filter @supastack/web dev, then run corepack pnpm jobs:tick from the root. Expected: the terminal shows a POST result from localhost:3000. Trigger.dev is a separate provider and needs its own account and server keys.",
    troubleshooting:
      "If the tick returns 404, confirm the secret exists in both settings files and matches exactly, then restart Web. If the terminal says connection refused, start Web first. If no job ran, check that a schedule is enabled and due; one tick does not make a future schedule run immediately.",
  },
  "modules/email-configuration": {
    setup:
      "1. Open apps/web/.env.local and set EMAIL_PROVIDER=local for development; EMAIL_FROM is the sender label used by templates. 2. Start the Web app from the repository root with corepack pnpm --filter @supastack/web dev and trigger one sign-in or invite flow with a test address. Expected: the app records a local email outcome without contacting a real provider. Only connect Resend, SES, or another service after its sender domain is verified and test recipients are restricted.",
    troubleshooting:
      "If no local email appears, check that EMAIL_PROVIDER is set in apps/web/.env.local and restart Web. If a real provider rejects a message, confirm EMAIL_FROM matches a verified sender and inspect the provider's delivery record. A generated AI answer can succeed even when its follow-up email fails; check delivery before running the AI task again.",
  },
  "modules/billing-configuration": {
    setup:
      "1. Open apps/web/.env.local and keep BILLING_PROVIDER=local while learning the checkout screen. 2. For a real integration, create test-mode products in one provider, then add its server keys and webhook secret to the Web host's private environment settings. A webhook is a signed message the billing service sends to your app after checkout, renewal, or cancellation; the endpoint path is listed in this guide's code example. 3. Start Web with corepack pnpm --filter @supastack/web dev and test only the sandbox. Expected: a verified webhook updates the signed-in workspace's entitlement; opening a checkout page alone does not grant access.",
    troubleshooting:
      "If a webhook is rejected, compare the exact sandbox URL and signing secret in the provider dashboard with the server settings, and check whether that provider requires forwarding requests to localhost. If checkout works but access stays locked, inspect the webhook result and the entitlement key on the plan. Never test with live payment credentials while following this local guide.",
  },
  "web/troubleshooting": {
    setup:
      "1. Copy the first useful error line and the command that produced it; do not paste secret values. 2. From the repository root run corepack pnpm --filter @supastack/web typecheck for Web type errors, or corepack pnpm test for the automated suite. 3. For a browser issue, start Web with corepack pnpm --filter @supastack/web dev and reproduce it at http://localhost:3000. Expected: you can tell whether the failure is in setup, code, database, provider, or the browser before changing settings.",
    troubleshooting:
      "If the page is on :3001, open :3000 for the Web app; :3001 belongs to the separate apps/docs server. If a test asks for database access, use an isolated development database and check both .env locations. If the same error remains, include the command and sanitized first error line when asking for help; never disable access checks or print secrets to logs.",
  },
  "web/organizations": {
    setup:
      "1. Start the Web app from the repository root with corepack pnpm --filter @supastack/web dev and create a test account. 2. Open the organization setup screen, create a test workspace, then invite a second test email from Settings → Members. A workspace is the team boundary that owns members and records. 3. Accept the invitation while signed in with that same email. Expected: the second account can enter the invited workspace with its assigned role, but cannot manage owner-only actions.",
    troubleshooting:
      "If an invite link says the email does not match, sign in using the exact address that received it. If the invitation email is missing, check the local email result before resending. If a member cannot see an organization, switch to the correct workspace and verify membership; never fix this by passing another workspaceId from the browser.",
  },
  "web/i18n": {
    setup:
      "1. Open packages/i18n/src/index.ts in VS Code to see the supported language names and locale helpers; locate the matching dictionary files before changing product copy. 2. Add the same new key and translation to English, German, Spanish, and French dictionaries. 3. From the repository root run corepack pnpm test -- packages/i18n/src/index.test.ts and start Web with corepack pnpm --filter @supastack/web dev. Expected: the language switcher changes the visible text while preserving the current page path.",
    troubleshooting:
      "If English appears for one phrase, check that the key exists in all four dictionaries and that the page asks for the same key. If switching languages returns to the homepage, preserve the current path when building the locale link. Keep email copy on the transactional email path; do not reuse it as bulk outreach.",
  },
  "modules/openrouter": {
    setup:
      "1. Open apps/web/.env.local for the Web server and apps/web/src/server-provider-composition.ts for provider selection. 2. If you have an OpenRouter account, set AI_PROVIDER=openrouter and store OPENROUTER_API_KEY in apps/web/.env.local; never use an EXPO_PUBLIC_ or NEXT_PUBLIC_ prefix. 3. Start Web from the root with corepack pnpm --filter @supastack/web dev, then enable a model and its current price in the admin catalog. Expected: an enabled app alias can choose the configured catalog model; merely adding a key does not add a model or its price.",
    troubleshooting:
      "If generation says no model is available, check the model's enabled status, price entry, and the AI_MODEL_POLICY alias. If OpenRouter returns unauthorized, verify the key in apps/web/.env.local and restart Web. Provider usage may be billed by OpenRouter, so use a limit and a test account before making a real request.",
  },
  "modules/agent-frameworks": {
    setup:
      "1. Open apps/web/src/agent-runtime.ts and leave AGENT_FRAMEWORK=ai-sdk, the default, while learning the shared tool setup. 2. From the repository root run corepack pnpm test -- apps/web/src/agent-runtime.test.ts. 3. Change the framework only when the matching adapter and a real AI provider are configured on the server. Expected: the same workspace tools are used regardless of adapter; this advanced guide changes how an agent runs, not the login or chat screens.",
    troubleshooting:
      "If a framework reports a missing model or client, check that its adapter supports your AI_PROVIDER and that the server key is configured. AI_PROVIDER=fake is for deterministic ordinary app flows and cannot run framework agents. Do not put a provider key in client-visible settings.",
  },
  "modules/mcp-server": {
    setup:
      "1. Sign in to the local Web app and open Settings → Developers to create an API key with only the scopes you need. 2. In your MCP client's private configuration file, paste this guide's JSON with your real app URL and key; treat the sk_ key like a password and never commit the config file. 3. From the root run corepack pnpm test -- apps/web/src/mcp-server.test.ts. Expected: a client can list only the tools allowed by that key; this endpoint uses API-key authentication, not your browser cookie.",
    troubleshooting:
      "If the client gets 401, check that its Authorization value is Bearer followed by the complete sk_ key and that the API URL ends in /api/mcp. A 405 means the client tried GET or DELETE; this endpoint accepts MCP requests by POST. Revoke any key pasted into a public issue or shared screenshot.",
  },
  "modules/custom-domains": {
    setup:
      "1. Open apps/web/.env.local and use CUSTOM_DOMAINS_PROVIDER=local to preview the Domains screen without DNS changes. 2. For a real customer hostname, configure Cloudflare for SaaS with your own zone, an API token limited to that zone, and the CNAME target; enter the server-only values on the Web host, not in the browser. 3. Run Web with corepack pnpm --filter @supastack/web dev and open Settings → Domains as a workspace owner/admin. Expected: the local adapter activates a test domain immediately; the Cloudflare adapter waits for the displayed DNS records.",
    troubleshooting:
      "If Cloudflare stays pending, compare the customer's CNAME and TXT records with the exact values shown on the domain card and allow DNS time to update. Use a subdomain when the DNS provider cannot flatten a root-domain CNAME. If the menu is absent, check that the feature is enabled and the signed-in user is a workspace owner or admin.",
  },
  "deploy/supabase-cloud": {
    setup:
      "1. Create a Supabase account and a Management API token, then open the repository-root .env only in your local editor. 2. From the repository root run corepack pnpm supabase:provision -- --org <your-org> --name <project-name> --region <region> without --yes first; this is a dry run and prints the proposed project. Creating a cloud project can incur charges, so review Supabase pricing before choosing its confirmation flag. 3. Put DATABASE_URL in both the root .env (Drizzle) and apps/web/.env.local (Next.js), then run corepack pnpm --filter @supastack/db db:migrate against the session pooler. Expected: Web and migrations point to the same development database.",
    troubleshooting:
      "If provisioning says a token is missing, check SUPABASE_ACCESS_TOKEN in the process or local shell settings; do not paste it into a public file. If Web cannot connect but migrations work, compare DATABASE_URL in apps/web/.env.local and root .env. For prepared-statement errors, use the session pooler for migrations and confirm the port and pgbouncer setting.",
  },
  "deploy/supabase-self-hosted": {
    setup:
      "1. This path requires a server and Docker; first follow [Supabase's current self-hosting guide](https://supabase.com/docs/guides/self-hosting/docker) and use a test server. 2. The current manual setup pins a self-hosted release, copies its docker folder into a separate supabase-project folder, and creates that project's .env from .env.example; replace every sample password and signing secret before starting it. From supabase-project, run docker compose pull and then sh run.sh start. 3. Keep database ports private, set the session-pooler DATABASE_URL in the supastack root .env and apps/web/.env.local, then migrate with corepack pnpm --filter @supastack/db db:migrate from the supastack root. Expected: Supabase services run on your server and supastack uses its Postgres database.",
    troubleshooting:
      "If a container does not start, check docker compose logs in the Supabase checkout before editing more settings. If the database rejects the login, compare the tenant name and password in DATABASE_URL with the pooler configuration. Never expose database ports 5432 or 6543 to the public internet; do not use the transaction pooler for migrations.",
  },
  "deploy/coolify-vps": {
    setup:
      "1. Create a VPS and Coolify installation using Coolify's current official guide; this path needs a public server, a domain, and a database you control. 2. In Coolify create an Application from the supastack repository, choose Dockerfile at the repository root, and set the app port to 8080 and health path to /api/health. 3. Add APP_URL, DATABASE_URL, and AUTH_SECRET in Coolify's runtime Environment Variables, then verify the database backup plan before running corepack pnpm --filter @supastack/db db:migrate from a repository checkout. Expected: the health check succeeds before you invite users. Hosting and provider accounts may have charges.",
    troubleshooting:
      "If the deployment cannot become healthy, confirm the container port is 8080, the health path is /api/health, and APP_URL exactly matches the public HTTPS address. If Web reports a missing database or secret, add it to runtime Environment Variables and redeploy. Do not mark deployment complete until /api/health returns success and sign-in is tested with a non-production account.",
  },
  "modules/billing-custom-adapter": {
    setup:
      "1. This guide is for a developer adding an unsupported billing company; begin at docs/custom-billing-adapter.md. 2. In VS Code follow one provider's example through packages/billing/src, packages/config/src, apps/web/src/server-provider-composition.ts, apps/web/src/billing-runtime.ts, and apps/web/app/api/billing/webhook. 3. Use a fake test client and run corepack pnpm test from the repository root before configuring a provider sandbox. Expected: the adapter passes a signed test event through the shared entitlement ledger. Do not test a new adapter with live payment credentials.",
    troubleshooting:
      "If the webhook cannot identify the workspace or plan, stop and add those values to the checkout metadata before accepting events. If a signature test fails, compare the provider's exact raw-body signing format and secret; never bypass verification to make a test pass. The complete provider contract is in docs/custom-billing-adapter.md.",
  },
  "modules/scheduled-digest": {
    setup:
      "1. Start Web from the repository root with corepack pnpm --filter @supastack/web dev and set EMAIL_PROVIDER=local in apps/web/.env.local. 2. In Settings → Developers → Cron schedules create email.digest with 0 9 * * 1; this means Monday at 09:00 UTC, not your computer's local time. 3. Put the same SCHEDULER_TICK_SECRET in apps/web/.env.local and the repository-root .env, then run corepack pnpm jobs:tick from the root. Expected: a tick processes only schedules whose next run is due; a future weekly schedule may correctly send nothing today.",
    troubleshooting:
      "If the tick is 404, check that the app's SCHEDULER_TICK_SECRET matches the root .env value and restart Web. If the tick succeeds but no email is sent, inspect whether the schedule is due, whether any content was published inside its lookback window, and the local email result. A tick does not force a future schedule to run early.",
  },
  "mobile/in-app-purchases": {
    setup:
      "1. Open apps/mobile/.env.local for public Expo SDK keys and apps/web/.env.local for server-only RevenueCat secrets; an EXPO_PUBLIC_ setting is bundled into the app and must never contain a secret. 2. Start the Web API with corepack pnpm --filter @supastack/web dev, then start Expo with corepack pnpm --filter @supastack/mobile start. 3. Use Expo Go only to preview screens; to verify a real purchase, build with EAS development profile and store sandbox products. Expected: the server grants access only after it verifies the workspace purchase. Mobile checkout never uses Stripe.",
    troubleshooting:
      "If the paywall has no offers, confirm the signed-in account is a workspace owner/admin and the server reports purchases enabled. If the store purchase succeeds but server sync fails, use Restore and retry sync; do not start another purchase. Expo Go and the local export cannot validate StoreKit or Play Billing transactions.",
  },
  "web/kit-blocks": {
    setup:
      "1. Open apps/web/src/kit/blocks.ts to browse the registry and apps/web/src/kit/blocks/ to view a block's component and style files. 2. From the repository root run corepack pnpm --filter @supastack/web dev, then open http://localhost:3000/kit-blocks. 3. Pick an existing block before making a new one; if a needed block is missing, copy its closest .tsx/.module.css pair and register it in blocks.ts. Expected: the dev preview lists the new block and its colors follow the theme tokens.",
    troubleshooting:
      "If /kit-blocks returns 404, confirm Web is running in development mode; this gallery is intentionally unavailable in production. If a block keeps its old colors after changing the theme, inspect its CSS for hard-coded colors and replace them with the shared tokens before adjusting the page.",
  },
  "modules/public-api": {
    setup:
      "1. Start Web from the repository root with corepack pnpm --filter @supastack/web dev and sign in to a test workspace. 2. Open Settings → Developers and create a read-only API key; copy it once to a private password manager. 3. From PowerShell or a terminal run curl.exe -H 'Authorization: Bearer sk_REPLACE_WITH_YOUR_KEY' http://localhost:3000/api/v1/workspaces/current. Expected: the response identifies only the key's workspace. A workspaceId in the request cannot switch the key into someone else's workspace.",
    troubleshooting:
      "If the API returns 401, check the complete key and the Bearer prefix; if it returns 403, create a key with the needed scope. Revoke a key pasted into chat or committed to a repository, then create a new one. Do not put API keys in browser JavaScript or public Expo settings.",
  },
  "web/seo-public-pages": {
    setup:
      "1. In VS Code open the public route file under apps/web/app/<route>/page.tsx and add its unique title, description, and canonical URL. 2. For a standalone marketing page, add the path and priority in apps/web/src/marketing/marketing-sitemap.ts; guide and blog records enter through their content lists. 3. From the repository root run corepack pnpm --filter @supastack/web typecheck and corepack pnpm test -- apps/web/src/marketing/marketing-sitemap.test.ts. Expected: the page has correct metadata and the sitemap test knows about a new public route.",
    troubleshooting:
      "If the page is missing from the sitemap, check whether it is a standalone route or part of a content collection and update the right source. Keep sign-in, billing, and other private app routes out of the public sitemap. If social image tags disappear after adding page metadata, set openGraph.images and twitter.images on that page as well.",
  },
};

const beginnerGuideCommands: Readonly<Record<string, string>> = {
  "web/adopt-patterns": "corepack pnpm test",
  "web/upgrading": "git status --short\ngit remote -v\ngit log --oneline -5",
  "web/project-structure": "corepack pnpm --filter @supastack/web dev",
  "web/database":
    "# Choose one copy method for your terminal:\n# PowerShell:\nCopy-Item .env.example .env\nCopy-Item .env.example apps/web/.env.local\n\n# macOS/Linux/Git Bash alternative:\n# cp .env.example .env\n# cp .env.example apps/web/.env.local\n\ndocker compose up -d postgres\ndocker compose ps\ncorepack pnpm --filter @supastack/db db:migrate",
  "web/theming":
    "corepack pnpm --filter @supastack/web dev\n\n# In a second terminal, after changing a theme token:\ncorepack pnpm test -- apps/web/src/theme/contrast.test.ts",
  "web/blog-content":
    "corepack pnpm --filter @supastack/web dev\n\n# Replace <your-slug> with the article slug:\n# http://localhost:3000/blog/<your-slug>\ncorepack pnpm test -- apps/web/src/resources/content.test.ts",
  "web/testing":
    "corepack pnpm test\ncorepack pnpm --filter @supastack/web typecheck\ncorepack pnpm test:e2e",
  "mobile/authentication":
    "# Terminal 1 — Web API (from the monorepo root):\ncorepack pnpm --filter @supastack/web dev\n\n# Terminal 2 — Expo app (from the monorepo root):\ncorepack pnpm --filter @supastack/mobile start",
  "mobile/builds":
    "# From the monorepo root, install the native development client once:\ncorepack pnpm --filter @supastack/mobile exec expo install expo-dev-client\ncorepack pnpm --filter @supastack/mobile typecheck\ncorepack pnpm --filter @supastack/mobile build\n\n# EAS needs to run where apps/mobile/eas.json is located:\ncd apps/mobile\nnpx eas-cli@latest build --platform android --profile development",
  "modules/ai-configuration": "corepack pnpm --filter @supastack/web dev",
  "modules/task-recovery": "corepack pnpm test -- apps/web/src/ai-task-runtime.test.ts",
  "modules/jobs":
    "# Terminal 1 — start the Web app from the monorepo root:\ncorepack pnpm --filter @supastack/web dev\n\n# Terminal 2 — run one scheduler tick from the monorepo root:\ncorepack pnpm jobs:tick",
  "modules/email-configuration": "corepack pnpm --filter @supastack/web dev",
  "modules/billing-configuration": "corepack pnpm --filter @supastack/web dev",
  "web/troubleshooting": "corepack pnpm --filter @supastack/web typecheck\ncorepack pnpm test",
  "web/organizations": "corepack pnpm --filter @supastack/web dev",
  "web/i18n":
    "corepack pnpm test -- packages/i18n/src/index.test.ts\ncorepack pnpm --filter @supastack/web dev",
  "modules/openrouter": "corepack pnpm --filter @supastack/web dev",
  "modules/agent-frameworks": "corepack pnpm test -- apps/web/src/agent-runtime.test.ts",
  "modules/mcp-server": "corepack pnpm test -- apps/web/src/mcp-server.test.ts",
  "modules/custom-domains": "corepack pnpm --filter @supastack/web dev",
  "deploy/supabase-cloud":
    "corepack pnpm supabase:doctor\ncorepack pnpm --filter @supastack/web dev",
  "deploy/supabase-self-hosted":
    "# In your separate Supabase Docker checkout, after configuring its .env:\ndocker compose pull\nsh run.sh start\n\n# Back in the supastack monorepo root, after DATABASE_URL is configured:\ncorepack pnpm --filter @supastack/db db:migrate",
  "deploy/coolify-vps":
    "# From a supastack repository checkout, with the production DATABASE_URL\n# configured privately and a backup verified first:\ncorepack pnpm --filter @supastack/db db:migrate\n\n# After Coolify deploys, check the public health endpoint:\ncurl.exe https://YOUR_DOMAIN/api/health",
  "modules/billing-custom-adapter": "corepack pnpm test",
  "modules/scheduled-digest":
    "# Terminal 1 — app server, with local email and tick secret configured:\ncorepack pnpm --filter @supastack/web dev\n\n# Terminal 2 — one due-schedule check from the monorepo root:\ncorepack pnpm jobs:tick",
  "mobile/in-app-purchases":
    "# Terminal 1 — Web API from the monorepo root:\ncorepack pnpm --filter @supastack/web dev\n\n# Terminal 2 — Expo app from the monorepo root:\ncorepack pnpm --filter @supastack/mobile start\n\n# To test native purchase APIs, build from the mobile folder:\ncd apps/mobile\nnpx eas-cli@latest build --platform android --profile development",
  "web/kit-blocks": "corepack pnpm --filter @supastack/web dev",
  "modules/public-api":
    '# Start Web first, then replace the placeholder with your test API key:\ncurl.exe -H "Authorization: Bearer sk_REPLACE_WITH_YOUR_KEY" http://localhost:3000/api/v1/workspaces/current',
  "web/seo-public-pages":
    "corepack pnpm --filter @supastack/web typecheck\ncorepack pnpm test -- apps/web/src/marketing/marketing-sitemap.test.ts",
};

export const additionalGuides: readonly Guide[] = [
  guide(
    "web/adopt-patterns",
    "web",
    "Getting started",
    "Adopt patterns in an existing stack",
    "Use supastack's billing and entitlement patterns in an existing Next.js, Express, or Capacitor product, with a safe path for access checks and schema changes.",
    [
      "Keep your current app and select one capability to port. Trace its contract, persistence schema, configuration, server caller, and tests before copying files. The full checklist is in docs/adopt-patterns.md in the supastack monorepo.",
      "For entitlement gating, keep payment events and access decisions separate: map a verified subscription or license to a workspace-scoped entitlement, then check that entitlement on the server before returning protected content. An existing license store can remain your source of truth.",
    ],
    "# Example adoption order\n1. Define user + workspace mapping\n2. Port entitlement record and migration\n3. Verify signed billing events in your server\n4. Enforce access in a protected API\n5. Add a Capacitor or other client presentation",
    [
      "Port a vertical slice, not a directory tree. Adapt imports and storage to your existing app, keep provider credentials on your server, and resolve workspaceId from the authenticated session rather than client input.",
      "A Capacitor client can consume a small entitlement API and render the locked or unlocked state. Native purchases require their own store policy and purchase integration; do not embed a web checkout shortcut in a mobile purchase flow.",
    ],
    [
      "Test a paid workspace, an unpaid workspace, anonymous access, and a request for another workspace's content. Verify that a failed billing webhook never grants access and a replay cannot double-apply an event.",
      "Record the source revision you copied and revisit upstream changes deliberately. See the Upgrade between revisions guide for a repeatable update path.",
    ],
  ),
  guide(
    "web/upgrading",
    "web",
    "Getting started",
    "Upgrade between revisions",
    "Upgrade a supastack fork or selected modules with a recorded source revision, schema and environment review, conflict resolution, and focused acceptance checks.",
    [
      "Record the kit commit you started from and the target commit before changing code. Compare the two revisions, review release notes and changed migration files, then make an upgrade branch. The full fork and selective-copy procedures are in docs/upgrading.md in the supastack monorepo.",
      "Use the upstream repository matching your checkout: the monorepo checkout your kit came with, or the matching web, mobile, or desktop repository you forked or purchased. Do not merge the monorepo into a platform-only fork.",
    ],
    "# Upstream is the repository you forked or purchased — substitute its real URL\n# (supastack-web shown; use supastack-mobile, supastack-desktop, or the monorepo as fits).\ngit remote add upstream https://github.com/<org>/supastack-web.git\ngit fetch upstream\ngit switch -c upgrade/kit-update\ngit log --oneline <previous-kit-sha>..upstream/main\ngit diff --stat <previous-kit-sha>..upstream/main",
    [
      "For a fork with shared history, merge the matching upstream branch into the upgrade branch and resolve conflicts around your product code. For selectively adopted modules, inspect and port changed contracts, schema, callers, and tests by hand; a Git merge is not meaningful without shared history.",
      "Back up production data, apply new database migrations before deploying code that needs them, and check for newly required environment values. Keep the old application version available for rollback; plan a data rollback separately when a migration changes stored records.",
    ],
    [
      "Run the relevant package tests, typecheck, and local browser flow. Verify sign-in, workspace isolation, entitlement changes, jobs, and the product-specific path you changed. Test a staging deployment with real infrastructure before production.",
      "After acceptance, record the new source commit and your adaptation notes so the next upgrade has a known starting point.",
    ],
  ),
  guide(
    "web/project-structure",
    "web",
    "Getting started",
    "Project structure",
    "Find the application, shared packages, and the boundaries between them.",
    [
      "The pnpm workspace contains Next.js in apps/web, Expo in apps/mobile, and shared packages under packages. Run workspace commands from the repository root. Application routes compose shared modules; product-specific behavior belongs in the consuming product.",
      "Read AGENTS.md and .ai/PROJECT_CONTEXT.md before changing behavior. File mirrors in .ai/ explain decisions and constraints that may not be apparent from a component alone.",
    ],
    "apps/web/app/       Routes and layouts\napps/web/src/       Web components and server composition\napps/mobile/        Expo application\npackages/           Shared contracts and adapters\ntests/              Cross-module and browser checks\ndocs/               Operational guides",
    [
      "Start with the route that owns the user action, follow its server handler, and then inspect the shared package it calls. A UI component should not recreate workspace resolution, billing authorization, or provider selection.",
      "When adding a route, decide whether it is public or authenticated. Resolve authenticated ownership on the server before accessing user records, and keep server credentials outside client imports.",
    ],
    [
      "Run the relevant tests and typecheck after changing a package contract. Inspect both web and mobile consumers when changing shared types. A successful web build alone does not establish compatibility with the native app.",
    ],
  ),
  guide(
    "web/database",
    "web",
    "Development",
    "Database and migrations",
    "Prepare Postgres and evolve the Drizzle schema with committed migrations.",
    [
      "Configure DATABASE_URL for the intended Postgres database in the server environment. Use a separate disposable database for integration acceptance. Never aim test migrations at a production database.",
      "The database workspace exports schema definitions and persistence helpers. Review packages/db/src/schema.ts and the migration directory before introducing a table or column.",
    ],
    "docker compose up -d postgres\ndocker compose ps\ncorepack pnpm --filter @supastack/db db:migrate\n\n# Only after changing packages/db/src/schema.ts:\ncorepack pnpm --filter @supastack/db db:generate\ncorepack pnpm --filter @supastack/db db:migrate",
    [
      "Generate a migration after editing the schema, inspect the generated SQL, and commit it with the schema change. Plan how existing records receive values before adding a required column.",
      "Include workspaceId on every user-owned record and carry that scope into reads and writes. Use immutable model-price history for AI accounting instead of rewriting prices used by existing usage records.",
    ],
    [
      "Apply migrations to an isolated database and run database-gated tests there. Missing credentials should produce an explicit skipped gate, not an assertion that persistence passed. If migration fails, inspect which statement failed and the current schema before retrying.",
    ],
  ),
  guide(
    "web/theming",
    "web",
    "Customization",
    "Product theme",
    "Customize kit product chrome for your SaaS — without editing the marketing brand theme.",
    [
      'Marketing brand and product theme are separate files. Edit apps/web/app/app-theme.css for dashboard, auth, settings, billing, chat, and org chrome. Add color packs in apps/web/src/theme/catalog.ts. Extend density, radius, font, and layout axes in apps/web/src/theme/presets.ts plus matching html[data-*] rules in app-theme.css. Pick the marketing identity in apps/web/src/theme/marketing-theme.ts (MARKETING_THEME_MODE: locked | inherit | a pack id) instead of editing apps/web/app/theme.css — that file\'s lock via .marketing-theme:not(.app-theme):not([data-theme]):not([data-marketing-theme="inherit"]) keeps the supastack Obsidian homepage brand by default.',
      "At runtime, Settings → Appearance → ThemePicker stores color, density, radius, font, and layout in browser cookie + localStorage (not an account field). The same page mounts the kit UI gallery so packs and presets live-update buttons, inputs, cards, badges, and dialogs. theme-boot.ts restores all axes before paint. Design detail and copy-paste examples live in docs/design/kit-product-theme.md and docs/design/kit-ui-gallery.md.",
    ],
    '/* Edit product chrome here — not theme.css */\n.app-theme {\n  --radius-card: 14px;\n  background: var(--page);\n  color: var(--text);\n}\n.app-theme .button-primary {\n  background: var(--accent);\n  color: var(--accent-ink);\n}\n\n/* catalog.ts — append a ThemeDefinition with every THEME_TOKEN_NAMES entry */\n{\n  id: "coral",\n  name: "Coral",\n  colorScheme: "light",\n  tokens: { "--page": "#fff7f4", "--accent": "#e06b4f" /* …full token set… */ }\n}',
    [
      "Prefer var(--page|--section|--raised|--text|--muted|--border|--accent|…) in app consumers (app-theme.css, globals.css aliases, WorkspaceShell routes). Do not reintroduce teal/pale hex shells or hardcode Obsidian hex into product UI.",
      "When adding a pack, keep contrast.test.ts green. When adding a preset id, update both presets.ts and the html[data-density|data-radius|data-font|data-layout] remaps in app-theme.css so ThemePicker and FOUC boot stay aligned.",
      'Default demo chrome is text-only. Add your own product name and optional logo. Marketing uses Obsidian while MARKETING_THEME_MODE is "locked"; products may pin another pack or inherit the visitor pick.',
    ],
    [
      "After editing kit theme tokens or packs, verify ThemePicker on /settings/appearance updates the kit UI gallery plus /dashboard, /auth, /billing, /chat, and org shells. Confirm / stays on the Obsidian marketing lock (unless MARKETING_THEME_MODE says otherwise). Run theme unit contracts (catalog, presets, contrast, theme-ownership, kit-ui-gallery) and application-theme Playwright when available. Check keyboard focus, contrast, 320px, and reduced motion.",
    ],
  ),
  guide(
    "web/blog-content",
    "web",
    "Customization",
    "Writing blog articles",
    "Publish local, typed articles with working categories and guide links.",
    [
      "Blog content is stored in src/resources/content.ts and blog-posts.ts. This is repository-managed content; there is no CMS publishing service. Each Post needs a unique slug, title, description, category, date, related guide, and sections.",
    ],
    "{\n  slug: 'your-article',\n  title: 'A specific reader question',\n  category: 'Guides',\n  date: '2026-09-07',\n  guide: 'web/local-setup',\n  sections: [{ id: 'start', title: 'Start here', paragraphs: ['Your original text.'] }]\n}",
    [
      "Follow a complete existing Post object for the remaining type fields. Keep the slug stable after publication so shared URLs continue to work. Headings need unique section IDs for the table of contents and anchor links.",
      "Categories derive from the article catalogue. The index uses URL-based filtering, and article routes generate metadata from the content. The guide value must match an existing documentation slug; related content should lead to a useful next step.",
    ],
    [
      "Run the content tests, open the article route, follow its related guide, and check the filtered index. Check dates and claims against the source material. Do not publish placeholder links or claim that an integration has been verified merely because it appears in an article.",
    ],
  ),
  guide(
    "web/testing",
    "web",
    "Development",
    "Testing strategy",
    "Understand what deterministic, browser, database, and provider checks establish.",
    [
      "The default test suite uses deterministic fake/local adapters. Browser tests cover user interactions; database acceptance and external provider smoke are separate gates. Run checks relevant to the changed behavior before broadening the scope.",
    ],
    "pnpm test\npnpm check\npnpm build\npnpm test:e2e\npnpm test:e2e:production",
    [
      "For behavior changes, write a failing acceptance test first. Pair successful access with denied anonymous and cross-workspace requests. For forms and task flows, verify loading, error, and recovery behavior as well as the happy path.",
      "An intercepted browser response proves that the interface responds to that fixture. It does not prove authentication persistence, payment processing, provider delivery, or a physical device callback.",
    ],
    [
      "If a database-gated test skips, configure its isolated test database before claiming that gate passed. If a browser runner emits passing assertions but hangs during teardown, report both facts; a stuck process is not a clean successful command.",
      "On Windows, an initial browser run may time out while Defender scans newly installed Playwright browsers or dependencies. Let installation finish, rerun the failed suite with pnpm test:e2e or pnpm test:e2e:production, and inspect its trace and Defender Protection History if it fails again. Leave system-wide protection enabled.",
      "The local browser suite owns port 3100 and refuses to reuse a process already listening there. Set PLAYWRIGHT_PORT to a free port before pnpm test:e2e if another app owns 3100; this prevents tests from silently targeting another project.",
    ],
  ),
  guide(
    "mobile/local-setup",
    "mobile",
    "Getting started",
    "Set up Expo in 5 minutes",
    "Launch the native Expo app against a reachable API after the workspace dependencies and device tools are ready.",
    [
      "This first-run path takes about five minutes once Node.js 22 or newer, Corepack with the repository's pnpm version, and workspace dependencies are ready. Use the local fake and local adapters for the initial preview; provider credentials, a production database, and store setup are later steps.",
      "Set EXPO_PUBLIC_API_URL to an API origin reachable from your simulator or phone and EXPO_PUBLIC_APP_SCHEME to the app scheme. Start the web app before testing authenticated flows. A phone's localhost points to the phone, so use an address your device can reach.",
    ],
    "# Start Expo and scan the QR code with a preview client\ncorepack pnpm --filter @supastack/mobile start\n\n# Or launch an installed simulator\ncorepack pnpm --filter @supastack/mobile android\n# macOS with Xcode: corepack pnpm --filter @supastack/mobile ios",
    [
      "Choose a phone or simulator that can reach the API origin, then sign in and confirm the workspace home and settings load. The iOS simulator requires macOS with Xcode; Android commands need an installed emulator or device. Review apps/mobile/app.config.ts if the authentication return link does not reopen the app.",
      "Expo Go is suitable for a first UI preview, not real native purchase acceptance. Public Expo variables are bundled into the app; never put database, billing, authentication-signing, or AI-provider secrets in them. StoreKit and Play Billing require an EAS development build with the native RevenueCat module configured.",
    ],
    [
      "Verify launch, API reachability, sign-in return, session restoration, and sign-out on the intended phone or simulator. Test both a fresh installation and a returning session; a desktop browser preview does not validate native behavior.",
      "A successful Metro preview or Expo export is local acceptance only. For purchases, signing, push delivery, or store submission, follow the EAS build and store guides and record the actual device/build used.",
    ],
  ),
  guide(
    "mobile/authentication",
    "mobile",
    "Core concepts",
    "Native authentication",
    "Handle the browser return path and stored sessions on mobile.",
    [
      "The mobile app uses the Better Auth Expo integration and native secure storage. API origin and app scheme must agree with the native configuration and the authentication server's allowed return flow.",
    ],
    "EXPO_PUBLIC_API_URL=https://your-api.example\nEXPO_PUBLIC_APP_SCHEME=supastack",
    [
      "Follow the existing native authentication client instead of copying web cookie assumptions into mobile. Open provider authentication through the configured browser flow, handle its callback, then resolve the authenticated session before presenting protected actions.",
      "Keep cancelled sign-in distinct from successful sign-in. Clear the previous user's local presentation on sign-out and verify the server session can no longer perform protected work.",
    ],
    [
      "Exercise cold-start callbacks, returning to a running app, cancelled sign-in, and expired sessions on the intended build. If the browser returns but the app remains signed out, inspect scheme matching and API reachability before changing provider configuration.",
    ],
  ),
  guide(
    "mobile/builds",
    "mobile",
    "Development",
    "Build and device verification",
    "Separate a successful Expo export from release readiness.",
    [
      "The mobile workspace build invokes its export script. This validates bundling for the configured targets; store signing, distribution configuration, and physical-device acceptance remain separate work.",
    ],
    "pnpm --filter @supastack/mobile typecheck\npnpm --filter @supastack/mobile test\npnpm --filter @supastack/mobile build",
    [
      "Run shared contract tests after changing a package consumed by mobile. Review native safe areas, keyboard behavior, readable text sizing, and reduced motion on the devices you intend to support.",
      "Keep native purchases behind the existing RevenueCat boundary. A successful bundle must not introduce Stripe Checkout into the mobile interface as a substitute for a verified native purchase integration.",
      "Use an EAS development build on iOS or Android to validate `react-native-purchases` against configured sandbox products. Expo Go and the workspace export script do not validate store transactions.",
    ],
    [
      "Record the device, build, API environment, and sign-in method used for acceptance. Verify deep-link return, session restoration, denied entitlements, and sign-out. Report export success separately from store and device verification.",
      "When the export passes and a release is the goal, follow Submit to the app stores — the shipped eas.json profiles and build:/submit: scripts carry the app to Google Play and the App Store.",
    ],
  ),
  guide(
    "modules/ai-configuration",
    "modules",
    "AI and operations",
    "AI providers and model policy",
    "Configure server-owned providers and the aliases exposed to users.",
    [
      "The default AI_PROVIDER=fake supports local deterministic work. Real provider configuration belongs in the server environment. The provider keys listed in .env.example include OpenAI, Anthropic, and an OpenAI-compatible endpoint.",
      "AI_MODEL_POLICY contains ordered model IDs for cheap, fast, and smart aliases. An empty alias list disables that choice. Model IDs must correspond to enabled database catalogue entries with effective immutable pricing.",
    ],
    'AI_MODEL_POLICY=\'{"cheap":[],"fast":["catalog-model-id"],"smart":["catalog-model-id"]}\'',
    [
      "Configure the catalogue and workspace policy before accepting production tasks. The browser receives enabled aliases, while capability matching, model selection, entitlement checks, and budget enforcement stay on the server.",
      "Keep credentials out of NEXT_PUBLIC_ and EXPO_PUBLIC_ variables. For bring-your-own-key mode, use the existing encrypted envelope and server decryption boundary; never return a stored provider key to the interface.",
    ],
    [
      "Verify disabled aliases, missing capabilities, inactive entitlement, and exhausted budgets. Use a separately authorized provider smoke run for actual generation. If no alias is available, inspect server policy and catalogue configuration rather than exposing a raw model selector.",
    ],
  ),
  guide(
    "modules/task-recovery",
    "modules",
    "AI and operations",
    "Task API and recovery",
    "Recover an uncertain submission without creating a new task.",
    [
      "POST /api/ai/tasks requires an authenticated workspace and active entitlement. A keyed request reserves an immutable task before dispatch. Idempotency-Key accepts 16–128 ASCII letters, digits, underscores, or hyphens.",
    ],
    'POST /api/ai/tasks\nIdempotency-Key: a-stable-client-submission-key\n\nRecovery body: { "resume": true }\nStatus: GET /api/ai/tasks/{taskId}',
    [
      "Persist the recovery key before submitting. After uncertain dispatch, reuse the same key and the resume body; the server loads the original input and retries the same task-scoped Trigger identity. Changed input under the same key returns 409 idempotencyConflict.",
      "HTTP 202 after an ambiguous enqueue means dispatch is uncertain. It does not prove Trigger accepted the work. Already running or terminal tasks return saved state without another enqueue. Recovery still requires authentication, ownership, and entitlement.",
    ],
    [
      "Exercise a lost response, changed-input conflict, foreign-workspace request, and refresh restoration. There is no automatic outbox dispatcher or end-to-end exactly-once guarantee. Do not reset a running task to queued without investigating its side effects.",
    ],
  ),
  guide(
    "modules/jobs",
    "modules",
    "AI and operations",
    "Trigger.dev jobs",
    "Keep durable workflow behavior explicit.",
    [
      "Set JOB_PROVIDER=trigger with server-only TRIGGER_SECRET_KEY and TRIGGER_PROJECT_REF for production task submission. Review apps/web/trigger.config.ts and the ai.generate task in apps/web/trigger before configuring the target project.",
    ],
    "JOB_PROVIDER=trigger\nTRIGGER_PROJECT_REF=your-project-reference\n# Provide TRIGGER_SECRET_KEY through the server secret store.",
    [
      "The shared JobRunner contract promises enqueue, status, and cancel. Trigger.dev owns workflow-specific semantics; do not infer scheduling, retries, or durability guarantees from the generic interface.",
      "The durable application task ID connects dispatch, worker execution, usage records, and results. A failed provider-run metadata attachment after confirmed enqueue must not cause another enqueue or invalidate accepted work.",
    ],
    [
      "Verify the deployed task identifier and project match the configured environment. Separate enqueue acceptance from workflow completion and from email delivery. Read docs/production-ai-runtime.md for recovery and safe diagnostics before manually retrying work.",
    ],
  ),
  guide(
    "modules/email-configuration",
    "modules",
    "AI and operations",
    "Email provider configuration",
    "Configure transactional delivery and verify its independent outcome.",
    [
      "EMAIL_PROVIDER=local keeps deterministic delivery local. For configured production delivery, review the Resend or SES adapter and provide its server credentials. EMAIL_FROM must match the identity verified with the selected provider.",
    ],
    "EMAIL_PROVIDER=local\nEMAIL_FROM=supastack <hello@example.test>\n# Production adapter configuration is listed in .env.example.",
    [
      "Authentication and completion messages use the transactional email boundary. Outreach workflows belong to the consuming product and remain separate. Never reuse this path as an unreviewed bulk messaging subsystem.",
      "Record delivery separately from generation. A model result can be available while its completion message fails. Recovery must inspect delivery state instead of generating the same result again.",
    ],
    [
      "Verify recipient restrictions, sender identity, and provider errors in a dedicated test environment. A local adapter result is not evidence of real email delivery. The opt-in smoke path restricts recipients through REAL_SMOKE_EMAIL_ALLOWED_DOMAIN.",
    ],
  ),
  guide(
    "modules/billing-configuration",
    "modules",
    "Identity and access",
    "Billing provider configuration and webhooks",
    "Connect web subscriptions to server-owned entitlements.",
    [
      "Use sandbox/test credentials while integrating. Configure BILLING_PROVIDER plus the provider's server-only secrets: stripe → STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET; lemonsqueezy → LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_STORE_ID, LEMONSQUEEZY_VARIANT_ID, LEMONSQUEEZY_WEBHOOK_SECRET; creem → CREEM_API_KEY, CREEM_PRODUCT_ID, CREEM_WEBHOOK_SECRET (CREEM_TEST_MODE=true for the sandbox); polar → POLAR_ACCESS_TOKEN, POLAR_PRODUCT_ID, POLAR_WEBHOOK_SECRET (POLAR_SERVER); whop → WHOP_API_KEY, WHOP_PLAN_ID, WHOP_WEBHOOK_SECRET; paddle → PADDLE_API_KEY, PADDLE_PRICE_ID, PADDLE_WEBHOOK_SECRET (PADDLE_ENVIRONMENT); dodo → DODO_PAYMENTS_API_KEY, DODO_PRODUCT_ID, DODO_PAYMENTS_WEBHOOK_KEY (DODO_PAYMENTS_ENVIRONMENT); paypal → PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_PLAN_ID, PAYPAL_WEBHOOK_ID (PAYPAL_ENVIRONMENT). The price/product must represent the intended recurring subscription.",
    ],
    "Webhook endpoint: /api/billing/webhook (stripe), /api/billing/webhook/lemonsqueezy, /api/billing/webhook/creem, /api/billing/webhook/polar, /api/billing/webhook/whop, /api/billing/webhook/paddle, /api/billing/webhook/dodo, /api/billing/webhook/paypal\nCheckout endpoint: /api/billing/checkout\nPortal endpoint: /api/billing/portal",
    [
      "Follow the lifecycle event list in docs/real-provider-smoke.md when configuring the webhook endpoint. Signature verification requires the endpoint's matching webhook secret. A checkout redirect alone must never grant access.",
      "The entitlement at the server action boundary decides whether paid work is permitted. Process repeated events safely and scope customer/subscription records to the correct workspace. Web checkout remains separate from native purchases.",
      "The key a plan grants is product vocabulary shared across surfaces: ProductPlan.entitlement in src/product-plans.ts declares the lowercase machine key written into the ledger while a plan is paid (the kit ships 'ai.reference-task' on pro and lifetime; src/billing-runtime.ts passes it to the BFF). The same key is what a CMS entry's required_entitlement field and the EntitlementGate component's entitlementKey prop equality-compare against — an entry gated on 'ai.reference-task' unlocks for any workspace holding that grant, while a key no plan grants stays locked for everyone.",
    ],
    [
      "Test activation, updates, cancellation, invalid signatures, and repeated events in the sandbox. Inspect persisted access state after processing. Creating an unconsumed checkout session proves connectivity only, not lifecycle fulfillment.",
    ],
  ),
  guide(
    "web/troubleshooting",
    "web",
    "Development",
    "Troubleshooting",
    "Diagnose setup problems at the boundary that actually failed.",
    [
      "Read the failing command and first relevant error before changing configuration. Determine whether the failure is dependency installation, compilation, environment validation, database access, provider dispatch, or browser behavior.",
    ],
    "pnpm --filter @supastack/web typecheck\npnpm --filter @supastack/web build\npnpm test",
    [
      "For missing API access, verify the server is running and the configured origin matches the client. For unavailable AI choices, inspect AI_MODEL_POLICY and enabled catalogue rows. For an uncertain queued task, use the saved recovery flow instead of starting another submission.",
      "For browser layout issues, inspect computed styles and reproduce the exact viewport. Product chrome tokens live in app-theme.css (packs from catalog.ts); marketing brand lock lives in theme.css. Component overrides can still win through specificity. Check the rendered radius rather than only the token declaration.",
    ],
    [
      "Do not solve a failing check by disabling authorization, logging secrets, or treating skipped infrastructure checks as passed. Capture a small reproduction and the relevant non-secret configuration. Re-run the failing check after the fix, then the affected regression tests.",
    ],
  ),
  guide(
    "web/organizations",
    "web",
    "Product surfaces",
    "Organizations and invites",
    "Ship the demo-style org loop: create, switch, invite, roles, leave, and danger-zone delete.",
    [
      "Organization workspaces are distinct from personal workspaces in packages/db. After signup, onboarding gates (/onboarding, /new-organization, /select-organization, /choose-plan) push the user into an active org before product billing and settings.",
      "Invites create a pending workspace_invitation row and send transactional email with a /invite/[token] accept URL. Accept requires a matching signed-in email. Member list, role updates, and leave live under /settings/members; rename/delete and leave also appear on /organization/settings.",
    ],
    "Routes\n  /new-organization\n  /select-organization\n  /invite/[token]\n  /settings/members\n  /organization/settings\n\nServer actions\n  createOrganizationAction\n  createWorkspaceInviteAction\n  acceptWorkspaceInviteAction\n  updateMemberRoleAction\n  leaveOrganizationAction\n  renameOrganizationAction\n  deleteOrganizationAction",
    [
      "Resolve the active workspace from cookie → user preference → membership, then verify membership on every write. Owners and admins manage invites/roles; sole owners cannot leave or demote themselves.",
      "Prefer evaluateLeaveOrganization and evaluateMemberRoleUpdate from @supastack/db before mutating memberships. Emit member.left / member.role_changed in-app notifications after successful mutations when inAppProduct is enabled.",
      "Platform administration is a separate shipped boundary: only platform admins can manage users, bans and impersonation. A workspace owner/admin role does not grant platform access. The documented organization roles are owner, admin and member.",
    ],
    [
      "Focused Vitest: workspace leave/role helpers, invite acceptance, organization-onboarding gates. Manual: create org → invite → accept on a second account → update role → leave as non-owner → delete as owner with typed confirm.",
    ],
  ),
  guide(
    "web/i18n",
    "web",
    "Customization",
    "Locales and copy",
    "Use the en/de/es/fr dictionary scaffold for marketing chrome, settings IA, mail, and notification events.",
    [
      "Locales live in @supastack/i18n with SUPPORTED_LOCALES, LOCALE_COOKIE, resolveLocale, getDictionary, and localePath. Proxy sets x-supastack-locale and handles canonical English redirects; LanguageSwitcher updates the cookie and preserves active sub-paths. Key app routes (/ai, /settings, /billing, /chat) work directly under /[locale] prefixes alongside the soft /{locale} marketing home.",
      "Dictionaries cover marketing nav, settings section labels, organization settings chrome, transactional mail (invite/OTP/magic-link/AI/billing), notification preference labels, and in-app notification event copy.",
    ],
    'import { getDictionary, resolveLocale, LOCALE_COOKIE } from "@supastack/i18n";\n\nconst locale = resolveLocale([\n  cookieStore.get(LOCALE_COOKIE)?.value,\n  headers.get("x-supastack-locale"),\n  headers.get("accept-language"),\n]);\nconst copy = getDictionary(locale);',
    [
      "Pass locale into server-rendered settings/org pages and into notificationCopyForEvent / auth mail delivery options when available. Keep English as DEFAULT_LOCALE and avoid inventing marketing claims outside dictionary keys.",
      "Transactional mail stays separate from outreach. Expand dictionaries before nesting every marketing route under [locale].",
    ],
    [
      "Run packages/i18n Vitest, proxy tests, and locale-app-routes tests. Spot-check LanguageSwitcher on / and localized Settings/org/ai/billing/chat headings when the locale prefix is de/es/fr.",
    ],
  ),
  guide(
    "modules/openrouter",
    "modules",
    "AI and operations",
    "OpenRouter",
    "Route every catalog model through OpenRouter with one server key.",
    [
      "Set AI_PROVIDER=openrouter with a server-only OPENROUTER_API_KEY to route all AI aliases through OpenRouter. Model IDs use the provider-prefixed form (for example anthropic/claude-sonnet-4) and are still governed by the database catalogue and AI_MODEL_POLICY aliases.",
      "OPENROUTER_APP_NAME and OPENROUTER_SITE_URL are optional attribution values sent as the X-Title and HTTP-Referer headers so OpenRouter rankings and dashboards can attribute traffic to your app.",
    ],
    "AI_PROVIDER=openrouter\nOPENROUTER_API_KEY=sk-or-...\nOPENROUTER_APP_NAME=Your App\nOPENROUTER_SITE_URL=https://your-app.example\n# Catalog model ids look like: anthropic/claude-sonnet-4",
    [
      "Enable OpenRouter catalogue model rows through the admin model catalog just like any other provider; there is no seeded pricing — enter the current OpenRouter prices as immutable model-price history.",
      "Workspace BYOK keys can also target the openrouter provider through the existing encrypted key vault; the platform key and BYOK resolution share the same SdkAiProvider contract.",
    ],
    [
      "Run the config and provider-composition tests after enabling the provider. Verify a disabled-alias and missing-key configuration fails loudly, then use a provider smoke run for real generation. Keep the key server-only — never expose it through NEXT_PUBLIC_ or EXPO_PUBLIC_ variables.",
    ],
  ),
  guide(
    "modules/agent-frameworks",
    "modules",
    "AI and operations",
    "Agent frameworks",
    "Pick the agent runtime via AGENT_FRAMEWORK without changing your tools.",
    [
      "@supastack/agents defines a framework-neutral tool and runner contract. AGENT_FRAMEWORK selects the adapter at runtime: ai-sdk (default, Vercel AI SDK generateText), mastra, langgraph, or openai-agents. Unused framework SDKs are loaded lazily via dynamic import.",
      "Tools are defined once with defineTool in a shared registry — names are snake_case, each tool declares a read or write scope, and the model can never supply workspaceId: the server injects ToolContext (workspaceId, userId, scopes) at execution time.",
    ],
    "AGENT_FRAMEWORK=ai-sdk  # ai-sdk | mastra | langgraph | openai-agents",
    [
      "Create a runner with createWorkspaceAgentRunner(serverConfig, modelId) in apps/web/src/agent-runtime.ts. It builds an AI SDK language model for openai/anthropic/openai-compatible/openrouter, plus a LangChain ChatOpenAI companion for the langgraph adapter where one exists (anthropic has none).",
      "The langgraph adapter requires langChainModel; pair it with openai, openai-compatible, or openrouter. The openai-agents adapter disables OpenAI tracing so nothing phones home. AI_PROVIDER=fake throws — agents need a real provider.",
      "Run an agent inside the ModelRouter budget with the server-only `runBudgetedAgent` helper in `apps/web/src/agent-budget.ts` — production callers go through `getAgentRunRuntime().runAgent(input, tools)` in `apps/web/src/ai-task-runtime.ts`. The helper resolves the workspace AI context, loads the catalog model and its price for the requested `modelId`, records an `agent.run` task row, and reserves the `maxSteps`-scaled estimate through the same `authorizeAiProviderAttempt` budget path as chat before any provider call; a denied workspace throws `WorkspaceBudgetExceededError` and the runner is never created.",
      "Agent runs bill the platform provider key, so workspaces on their own provider key (BYOK) are rejected up front until agent runtimes can resolve workspace keys — the budget path never silently spends the platform key on a BYOK workspace. A catalog model without tools support also fails early when the caller requests tool scopes.",
      "Worked example for a route handler or server action: `const tools = createWorkspaceTools({ bff: apiV1Bff, headers: request.headers })` from `apps/web/src/workspace-tools.ts`, then `const run = await runAgent({ modelId, prompt, scopes: [\"read\"], userId, workspaceId }, tools)`. The caller's headers keep the shared workspace tools under the caller's own REST authorization, the injected `ToolContext` (`workspaceId`, `userId`, `scopes`) can never be widened by the model, and after the run actual token usage is appended to `ai_usage`, the reservation settles at real cost — at the estimate when a framework reports none — and the result persists on the task row.",
    ],
    [
      "Run the @supastack/agents contract tests — all four adapters execute the same scripted tool-call turn offline. Agent runs are server-side only and deliberately have no public endpoint: they would bypass the ModelRouter budget that AI task aliases enforce.",
      "Exercise the budgeted path offline with injected fakes like `apps/web/src/agent-budget.test.ts` does: assert the authorize → run → append usage → settle → persist order, budget denial before the runner is created, hold release at zero on a failed run, and scope-filtered tools — a real provider key is only needed for a live smoke run.",
    ],
  ),
  guide(
    "modules/mcp-server",
    "modules",
    "AI and operations",
    "MCP server",
    "Expose workspace tools to MCP clients over Streamable HTTP.",
    [
      "POST /api/mcp is a stateless Streamable HTTP MCP endpoint built on @modelcontextprotocol/sdk. Authentication is API keys only — the same sk_ keys and scopes as the public /api/v1 REST API. Cookie sessions never apply; missing or invalid keys get a 401 with a Bearer challenge, and GET/DELETE return 405.",
      "The endpoint registers only the tools the key's scopes allow from the shared workspace-tool registry (get_workspace, list_entitlements, create_ai_task, get_ai_task, get_ai_task_result). Every call reuses the /api/v1 BFF with the caller's headers, so REST authorization, workspace checks, and scope enforcement are identical — the MCP surface never widens access.",
    ],
    '{\n  "mcpServers": {\n    "supastack": {\n      "url": "https://<app>/api/mcp",\n      "headers": {\n        "Authorization": "Bearer sk_..."\n      }\n    }\n  }\n}',
    [
      "Issue a scoped key from Settings → Developers (or the API-keys flow) and hand the client the Authorization header shown above. A read-only key sees only read tools; write tools such as create_ai_task appear only for keys with the write scope.",
      "The endpoint shares the /api/v1 rate limiter. Tool results are JSON text content; workspace errors surface as isError results with the REST error message — no stack traces or secrets cross the boundary.",
    ],
    [
      "Drive initialize → tools/list → tools/call against the handler in tests with a fake registry before touching production keys. Verify a read-scoped key cannot see write tools and that requests without Authorization are rejected even when a session cookie is present.",
    ],
  ),
  guide(
    "modules/custom-domains",
    "modules",
    "AI and operations",
    "Custom domains and white label",
    "Serve workspace-branded hostnames through Cloudflare for SaaS.",
    [
      "Set CUSTOM_DOMAINS_PROVIDER=cloudflare with CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, and CUSTOM_DOMAIN_CNAME_TARGET. The API token needs SSL and Certificates:Edit permission on the zone (the Custom Hostnames API lives under /zones/{zone_id}/custom_hostnames). The CNAME target is a hostname in your Cloudflare zone — for example customers.example.com — that resolves to your deployed app.",
      "Add a DNS record in the zone pointing the CNAME target at your origin (the fallback origin in Cloudflare for SaaS terms). Cloudflare issues each custom hostname a DCV TXT record plus an optional ownership TXT record; the settings screen shows customers exactly which records to create.",
      "For local development use CUSTOM_DOMAINS_PROVIDER=local, which marks every hostname active immediately with target customers.localhost. CUSTOM_DOMAINS_PROVIDER=off (the default) hides the section's controls.",
    ],
    "CUSTOM_DOMAINS_PROVIDER=cloudflare\nCLOUDFLARE_API_TOKEN=cf_token_with_ssl_edit\nCLOUDFLARE_ZONE_ID=zone_id\nCUSTOM_DOMAIN_CNAME_TARGET=customers.example.com",
    [
      "Workspace owners and admins manage domains under Settings → Domains (five per workspace). Customers point a CNAME record for their hostname at the CNAME target, add the TXT records shown for ownership and certificate validation, then press Refresh status. Once Cloudflare reports the hostname active it becomes a trusted origin for auth on that deployment and the workspace name/logo brand the app chrome on that hostname.",
      "Apex (root) domains cannot be CNAMEs at most DNS providers — customers should use a subdomain such as portal.example.com, or a provider with CNAME flattening. Cookies stay scoped to each host, so a customer domain is a separate sign-in; single sign-on across custom domains is out of scope.",
    ],
    [
      "Pending for a long time usually means the customer's CNAME is missing or still propagating — re-check the DNS records shown on the domain card. A moved or failed status means Cloudflare can no longer resolve the hostname to the zone; remove and re-add it. Validation data is stored as provider JSON so future Cloudflare validation shapes need no schema change.",
    ],
  ),
  guide(
    "deploy/supabase-cloud",
    "modules",
    "AI and operations",
    "Supabase Cloud",
    "Provision a managed Postgres project and wire the kit onto Supabase.",
    [
      "Create a Management API token at supabase.com/dashboard/account/tokens, export SUPABASE_ACCESS_TOKEN, then run pnpm supabase:provision -- --org <slug> --name <name> --region <region>. Without --yes it is a dry run and prints the plan; creating a project can be billable on paid plans. With --write-env it fills DATABASE_URL (session pooler) and STORAGE_* in the root .env without overwriting existing keys unless --force is passed. --migrate runs pnpm --filter @supastack/db db:migrate against the session pooler afterwards.",
      "Choose the pooler deliberately. The session pooler (aws-0-<region>.pooler.supabase.com:5432, user postgres.<ref>) supports prepared statements — use it for migrations and long-lived servers. The transaction pooler (port 6543, pgbouncer) is for serverless functions and drops prepared statements; the kit's postgresClientOptions in packages/db detects port 6543, ?pgbouncer=true, or DATABASE_POOLER=transaction and sets prepare:false automatically. Direct connections (db.<ref>.supabase.co:5432) are IPv6-only on cloud — prefer the pooler from IPv4 networks.",
      "Manual path: create the project in the dashboard, copy the pooled connection string from Connect → Transaction/Session pooler, set DATABASE_URL with sslmode=require, and run the migrate script yourself.",
      "This kit uses Better Auth — not Supabase Auth — so auth tables, sessions, and providers live entirely in the kit's schema; Supabase only supplies Postgres and S3-compatible storage.",
    ],
    "DATABASE_URL=postgres://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require\nSTORAGE_PROVIDER=s3\nSTORAGE_ENDPOINT=https://<ref>.supabase.co/storage/v1/s3\nSTORAGE_REGION=<region>\nSTORAGE_BUCKET=<bucket>\nSTORAGE_ACCESS_KEY_ID=<s3 key>\nSTORAGE_SECRET_ACCESS_KEY=<s3 secret>",
    [
      "For Supabase Storage, set STORAGE_PROVIDER=s3 with the endpoint https://<ref>.supabase.co/storage/v1/s3 and your project region; the kit enables forcePathStyle automatically for custom endpoints. Create S3 access keys in Dashboard → Storage → S3 connection settings — the Management API cannot mint them.",
      "Backups: the free plan keeps daily backups; Pro adds point-in-time recovery. For your own dump use pg_dump against the session pooler or direct host.",
    ],
    [
      "Run pnpm supabase:doctor after provisioning: it reports server version, SSL, pooler mode vs prepared statements, pending Drizzle migrations, and — critically — any public tables exposed via PostgREST (RLS disabled or anon/authenticated grants) with the exact fix SQL. --fix-rls applies them in a transaction. Common failures: 'prepared statement already exists' means you connected through :6543 without the prepare:false the kit applies; 'too many connections' means you are exhausting the pooler — lower maxConnections.",
    ],
  ),
  guide(
    "deploy/supabase-self-hosted",
    "modules",
    "AI and operations",
    "Supabase self-hosted",
    "Run the full Supabase stack (Postgres, Supavisor, Storage) on your own host.",
    [
      "Follow [Supabase's current Docker self-hosting guide](https://supabase.com/docs/guides/self-hosting/docker): clone a version-pinned supabase/supabase checkout, copy its docker folder into a separate project folder, create .env from .env.example there, and replace every sample secret before starting services. The current guide starts the copied project with docker compose pull and sh run.sh start.",
      "This kit uses Better Auth, not Supabase Auth — you do not need to configure GoTrue providers for the kit; keep the bundled auth service internal if nothing else uses it. Supabase here supplies Postgres (via Supavisor) and S3-compatible Storage only.",
      "Supavisor exposes the session pooler on 5432 and transaction pooler on 6543. Usernames must be tenant-qualified on the pooler: postgres.<tenant-id> — the tenant id is your project ref configured in the pooler env (default pooler_tenant_id). Direct Postgres (port 5432 inside the network or the mapped port) works with plain postgres.",
      "Expose only the API gateway and Studio through your chosen reverse proxy; the current Supabase Docker guide uses Envoy by default, so follow the configuration for the pinned release. Keep database ports private — never publish 5432/6543 publicly — and put HTTPS in front of any public endpoint.",
      "Change the sample Studio username and password before allowing network access. Keep internal administration endpoints private and follow the current self-hosting guide for the ports used by the release you pinned.",
    ],
    "DATABASE_URL=postgres://postgres.<tenant>:<password>@<host>:5432/postgres\n# serverless functions: port 6543 adds ?pgbouncer=true (prepare is disabled automatically)\nSTORAGE_PROVIDER=s3\nSTORAGE_ENDPOINT=https://<host>:8000/storage/v1/s3\nSTORAGE_REGION=us-east-1  # required by the S3 protocol; self-hosted accepts any region value\nSTORAGE_FORCE_PATH_STYLE=true",
    [
      "Generate S3 credentials for self-hosted Storage in Studio → Storage → S3 connection settings (or seed them via the storage env in docker-compose); then set STORAGE_* in .env like the cloud guide. Run migrations with pnpm --filter @supastack/db db:migrate against the session pooler or direct Postgres — never the transaction pooler.",
      "Run pnpm supabase:doctor -- --fix-rls after migrating: self-hosted PostgREST exposes public-schema tables to the anon/authenticated roles exactly like cloud, so the kit's tables must have RLS enabled and the API roles revoked. The doctor prints the exact ALTER/REVOKE statements and applies them in one transaction.",
      "Upgrades: pull new images, pg_dump your database volume first, and re-run migrations. For backups, cron pg_dump against the direct Postgres port — the transaction pooler is unsuitable for dumps.",
    ],
    [
      "Failure modes: 'prepared statement ... does not exist' → verify the pooler URL and pgbouncer setting; the kit disables prepared statements for the transaction pooler. 'too many connections' → reduce the app's maxConnections or adjust the pooler limits. 'Tenant or user not found' → check the pooler username format required by the pinned release. If Studio loads but API calls fail, check the gateway routes and that the configured JWT keys match the regenerated signing secret.",
    ],
  ),
  guide(
    "deploy/coolify-vps",
    "modules",
    "AI and operations",
    "Self-hosted VPS with Coolify",
    "Run the whole stack on one cheap VPS managed by Coolify instead of Vercel/Railway.",
    [
      "Provision a VPS meeting Coolify's minimum (2 cores, 2 GB RAM, ~30 GB disk, amd64/arm64), open ports 22 (SSH), 80/443 (proxy + Let's Encrypt), and 8000/6001/6002 (dashboard, realtime UI, web terminal — closable once the dashboard sits behind a domain), then run the installer as root: curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash. Create the admin account at http://<server-ip>:8000 plus a project and environment.",
      "Decide where the image builds before sizing the box. The root Dockerfile runs a monorepo-wide pnpm install --frozen-lockfile and pnpm --filter @supastack/web build (Next.js standalone) inside the image — ~4 GB RAM on the box is comfortable, ~2 GB is the floor with swap plus a NODE_OPTIONS=--max-old-space-size build-time variable (Coolify injects build variables as Dockerfile ARGs by default; the Dockerfile declares no ARG itself, so verify it lands in the build log or add ARG NODE_OPTIONS to the build stage). The cheaper path: build in CI (GitHub Actions → GHCR) and deploy a Docker Image resource — a ~1–2 GB VPS then only runs the standalone server (~150–300 MB RSS, estimate) plus Postgres.",
      "Postgres: add a Coolify-managed database on the same box and point DATABASE_URL at its internal connection string (you own backups — schedule pg_dump), or use managed Postgres (Supabase, Neon) to free box RAM. On the smallest tiers the app and DB sharing RAM is another argument for the prebuilt image.",
      "All configuration is runtime-only — the image builds with no env — so set variables in Coolify's Environment Variables UI and keep the Build Variable flag off secrets (build args persist in image metadata). Minimum: APP_URL (final public HTTPS origin — drives auth trusted origins and canonicals), DATABASE_URL, AUTH_SECRET; APP_ENV=production additionally requires EXPO_PUBLIC_API_URL, EXPO_PUBLIC_APP_SCHEME, MOBILE_ALLOWED_ORIGINS, and CREDENTIAL_ENCRYPTION_KEY. Provider selectors default to local/fake/memory so the app boots without paid credentials; .env.example is the full inventory. Server secrets never get NEXT_PUBLIC_/EXPO_PUBLIC_ prefixes.",
    ],
    "APP_URL=https://app.example.com\nDATABASE_URL=postgres://postgres:<pw>@<postgres-service>:5432/supastack\nAUTH_SECRET=<32+ random chars>\n# APP_ENV=production also requires: EXPO_PUBLIC_API_URL (=APP_URL),\n# EXPO_PUBLIC_APP_SCHEME, MOBILE_ALLOWED_ORIGINS, CREDENTIAL_ENCRYPTION_KEY\n\n# Coolify Scheduled Task on the app — cron * * * * *; the command MUST be\n# a single line (it runs via sh inside the app container):\nnode -e \"fetch('http://127.0.0.1:8080/api/internal/scheduler-tick',{method:'POST',headers:{'x-scheduler-key':process.env.SCHEDULER_TICK_SECRET}}).then(r=>process.exit(r.ok?0:1))\"",
    [
      "Add an Application resource from the Git source (public URL, or private via the Coolify GitHub App / deploy key), set the build pack to Dockerfile (Coolify defaults to Nixpacks), Dockerfile location /Dockerfile, and the port to 8080 — the image EXPOSEs 8080 and runs node apps/web/server.js from .next/standalone; Coolify's default port is 3000. Configure the health check path /api/health (the Dockerfile ships no HEALTHCHECK).",
      "Migrate from outside the container: the production image ships only standalone output — drizzle-kit is not in it. Run pnpm --filter @supastack/db db:migrate from a repo checkout or CI job against the production DATABASE_URL before first deploy and after upgrades that add migrations.",
      "Recurring jobs need a ticker: with JOB_PROVIDER=local, add a Coolify Scheduled Task POSTing /api/internal/scheduler-tick with the x-scheduler-key header (requires SCHEDULER_TICK_SECRET — the endpoint 404s while unset). Or set JOB_PROVIDER=trigger with TRIGGER_SECRET_KEY/TRIGGER_PROJECT_REF and let Trigger.dev Cloud run the scheduler.tick cron.",
      "Set the app domain in Coolify — Let's Encrypt provisions automatically (keep port 80 open) — and make APP_URL equal the final public URL exactly. For real file storage set STORAGE_PROVIDER=s3 (Coolify can host MinIO) and pick a real EMAIL_PROVIDER; billing webhooks target https://<app>/api/billing/webhook[/<provider>]. Full walkthrough lives in docs/vps-coolify.md in the repo.",
    ],
    [
      "Follow the post-deploy checklist in docs/deployment.md: /api/health → sign-in + workspace isolation → billing webhook sandbox → a job run. If the on-box build OOMs, add swap and the NODE_OPTIONS cap or switch to the prebuilt-image path. A 404 on the tick endpoint means SCHEDULER_TICK_SECRET is unset; 'no available server' proxy errors mean the port or health check is wrong. RATE_LIMIT_STORE defaults to postgres in production, so a single instance already uses DB-shared buckets.",
    ],
  ),
  guide(
    "modules/billing-custom-adapter",
    "modules",
    "Identity and access",
    "Custom billing adapters",
    "Add a regional or unsupported gateway as a new BILLING_PROVIDER kind.",
    [
      "Six touchpoints wire a provider end to end: a packages/billing/src/<provider>.ts adapter plus its export block in that package's index.ts; the BILLING_PROVIDER enum, <X>_* env declarations, credential gating, and billing union in packages/config (also the providers.billing enum in publicConfigSchema — parsePublicConfig re-parses the kind); a provider arm in productPlanPriceMapFromEnv for <X>_PRICE_ID-style envs; a create<X>Client factory plus dispatch arm in src/server-provider-composition.ts; a <x>BillingBff export plus the activeBillingBff chain in src/billing-runtime.ts; and app/api/billing/webhook/<provider>/route.ts.",
      "Every adapter implements the same three-method contract and shares one entitlement ledger, so webhook dedupe, billing-customer rows, and entitlement writes come free. Secrets never enter packages/billing — the adapter takes an injected minimal client interface, and the fetch- or SDK-backed implementation lives in the composition root where env credentials live.",
    ],
    '// packages/billing/src/xendit.ts — illustrative skeleton (not shipped)\nexport interface XenditBillingClient {\n  createInvoice(input: XenditInvoiceCreateInput): Promise<XenditCheckoutSession>;\n  customerPortalUrl(customerId: string): Promise<XenditPortalSession>;\n}\n\nexport class XenditBillingAdapter {\n  constructor(private readonly client: XenditBillingClient) {}\n  createCheckoutSession(input: StripeCheckoutRequest): Promise<{ id: string; url: string | null }>\n  createPortalSession(input: StripePortalRequest): Promise<{ url: string }>\n  verifySignedWebhook(input: SignedStripeWebhookRequest):\n    | { verification: "rejected" }\n    | { verification: "verified"; event: VerifiedStripeBillingEvent }\n    // or Promise<…> — the BFF awaits either form\n}',
    [
      "createCheckoutSession must round-trip workspaceId + entitlement (usually priceId too) through the provider's metadata or custom field so the webhook can re-attribute the event — Stripe uses metadata; PayPal packs compact {e,p,w} JSON into a 127-character custom_id. verifySignedWebhook normalizes provider events; a null entitlementStatus returns ignored, while a verified event that cannot resolve workspaceId/entitlement throws in the ledger and the route returns 500 so the provider retries.",
      'Pitfalls: multi-header signature schemes pack into the single signature field at the route (encodeStandardWebhookSignature, encodePaypalWebhookSignature); never re-implement dedupe — the ledger keys webhook_event on (provider, eventId); seats handling is the adapter\'s choice (PayPal ignores it); plan.checkout === "stripe" is the generic web-checkoutable marker for every provider; mobile native purchases stay behind RevenueCat; the webhook URL is https://<app>/api/billing/webhook/<provider>.',
      "The full annotated checklist — config gating, plan-price envs, composition, runtime, route, tests, and docs inventory — lives in docs/custom-billing-adapter.md in the repo.",
    ],
    [
      "Extend adapter unit tests (signature accept/reject, event normalization, metadata round-trip), config credential-gating cases, composition dispatch cases, and the product-plans env map; billing-bff tests only matter when verification is async. Then follow the provider entry added to docs/real-provider-smoke.md and exercise the sandbox lifecycle: checkout → grant → replay stays a duplicate → portal → cancel → inactive.",
    ],
  ),
  guide(
    "modules/scheduled-digest",
    "modules",
    "AI and operations",
    "Scheduled content digests",
    "Email a periodic digest of freshly published content to workspace members.",
    [
      "The kit ships a workspace job type, email.digest, that emails a workspace's recently published content entries to its members. Create the schedule under Settings → Developers → Cron schedules: job type email.digest, cron 0 9 * * 1 for a weekly Monday 09:00 send. Cron expressions are five fields (minute hour day-of-month month day-of-week) evaluated in UTC, and upserts reject the reserved platform job types and crons that never fire while enabled.",
      "Schedules need a ticker. Locally and in CI, pnpm jobs:tick POSTs /api/internal/scheduler-tick once against a running app — the endpoint requires SCHEDULER_TICK_SECRET in the server env and 404s while unset. Under JOB_PROVIDER=trigger the scheduler.tick Trigger.dev cron performs the same claim → job.run dispatch.",
      "If the app or its ticker stays down through scheduled fires, recovery dispatches one late run — the stored occurrence — rather than replaying every elapsed fire, and the `missed_runs` column counts the skipped occurrences. The Cron schedules list shows the running total, so an app hosted on a laptop that sleeps will show missed runs after it wakes.",
      'The settings form stores type + cron only — no public API route accepts a schedule payload. To narrow the digest, set the schedule\'s input JSON: the job_schedule.input column is accepted by upsertSchedule (the same store the form writes through), so a server-side script — or a route your product adds — can upsert the schedule with { "type": "report", "lookbackDays": 14 }: type filters to one content type, lookbackDays sets the window (integer 1–90, default 7). Malformed values fall back to the defaults at run time rather than failing the dispatch.',
    ],
    '# Settings → Developers → Cron schedules\nJob type: email.digest\nCron:     0 9 * * 1        # weekly, Monday 09:00 UTC\n\n# Optional input — job_schedule.input (jsonb), set via upsertSchedule;\n# the settings form writes type + cron only:\n{ "type": "report", "lookbackDays": 14 }\n\n# One tick against a running local app:\nSCHEDULER_TICK_SECRET=... pnpm jobs:tick',
    [
      "On each fire the handler lists the workspace's published content entries inside the window (newest first, capped at 50), builds a plain-text digest — '• Title (type)' lines plus an excerpt line when present — and the shared transactional sender renders it into the branded template, one email per member. Entries gated on an entitlement stay in the digest tagged [<key> tier]: the recipients are the publishing team, so gating is shown, not filtered.",
      "An empty window sends nothing and still records job.completed {sent: 0}; a per-recipient send failure counts failed without aborting the remaining members, and the completion event carries {entries, recipients, sent, failed}. Recipient fan-out is capped (100 members per fire) so sequential sends stay inside the handler's dispatch budget. Members can't opt out individually — the digest addresses every workspace member; removing the schedule stops delivery. email.digest is a workspace job: platform schedules (null workspaceId) skip with a log line, and the type is deliberately not in PLATFORM_JOB_TYPES so workspace schedules may register it.",
      'Digest mail is product mail to members — it goes through the transactional boundary (category "transactional"), never the outreach path. Products add their own scheduled work with registerJobHandler(type, handler) from src/job-handlers.ts; last write wins, so a product may replace the built-in digest.',
    ],
    [
      "Create the schedule, run pnpm jobs:tick (or POST /api/internal/scheduler-tick with the x-scheduler-key header), and confirm a digest lands in the local outbox under EMAIL_PROVIDER=local. If nothing arrives, check the window — only entries whose publishedAt sits inside the lookback are included — and confirm the schedule row is enabled with a due nextRunAt.",
      "A 404 on the tick endpoint means SCHEDULER_TICK_SECRET is unset. 'Unknown job type' in observability means the schedule predates the handler — email.digest ships in the built-in registry, so redeploy. A job.completed event with failed > 0 means some member sends rejected; inspect the email provider rather than the scheduler.",
    ],
  ),
  guide(
    "mobile/in-app-purchases",
    "mobile",
    "Core concepts",
    "In-app purchases",
    "Configure native purchases end to end with RevenueCat, workspace-scoped identity, and server-verified entitlements.",
    [
      "Set EXPO_PUBLIC_MOBILE_PURCHASES_PROVIDER to off, revenuecat, or fake; fake is accepted only in development. For RevenueCat, provide the platform-matching EXPO_PUBLIC_REVENUECAT_IOS_API_KEY or EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY. These SDK keys are public; keep REVENUECAT_SECRET_API_KEY and REVENUECAT_WEBHOOK_AUTHORIZATION on the server.",
      "The app first calls GET /api/mobile/purchases/sync. Only when the server reports purchases available for an owner/admin does the client configure RevenueCat, log in with the stable workspace app user ID, and load offerings. A successful native purchase or restore is followed by POST /api/mobile/purchases/sync so the server can fetch current store state and refresh the workspace entitlement.",
      "Set the server MOBILE_PURCHASES_PROVIDER to off or revenuecat and configure the RevenueCat entitlement ID/key to match the project. The webhook at /api/billing/webhook/revenuecat authenticates the exact Authorization header, then re-fetches current subscriber state; event claims alone never grant access. Workspace access comes from the shared server entitlement ledger. Only owners and admins can manage purchases, and mobile never uses Stripe Checkout.",
    ],
    "# Expo public configuration\nEXPO_PUBLIC_MOBILE_PURCHASES_PROVIDER=revenuecat\nEXPO_PUBLIC_REVENUECAT_IOS_API_KEY=<public-ios-sdk-key>\nEXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=<public-android-sdk-key>\n\n# Server-only verification configuration\nMOBILE_PURCHASES_PROVIDER=revenuecat\nREVENUECAT_SECRET_API_KEY=<server-secret>\nREVENUECAT_WEBHOOK_AUTHORIZATION=<exact-authorization-header>\nREVENUECAT_ENTITLEMENT_ID=pro\nREVENUECAT_ENTITLEMENT_KEY=ai.reference-task",
    [
      "Render the paywall from PaywallPresentation — reducePaywallEvent owns the state machine, while server entitlements remain the authority for workspace access. RevenueCat customer info is useful for immediate UI feedback but is not proof that the server has granted access.",
      "The RevenueCat webhook re-fetches the latest subscriber record and checks expiry, refunds, and sandbox status before updating the common entitlement ledger. Sandbox grants are disabled in production. Configure the same entitlement identifier and offering in RevenueCat and the store consoles before testing purchases.",
      "If the store completes a purchase but the server sync fails, the client disables another purchase and directs the user to Restore. Restore the store transaction and retry server sync so the customer is not charged a second time.",
    ],
    [
      "Use the fake provider for deterministic UI tests, but do not treat it as purchase acceptance. Expo Go does not validate real store purchases; test with an EAS development build, configured App Store Connect/Google Play products, RevenueCat offerings, and sandbox tester accounts. Verify purchase, restore, cancellation, expiry, and that the server entitlement refresh matches the active workspace.",
    ],
  ),
  guide(
    "web/kit-blocks",
    "web",
    "Customization",
    "Kit block library",
    "Compose pages from the copyable token-only blocks instead of inventing section patterns.",
    [
      "apps/web/src/kit/blocks holds the copyable UI blocks, organized by surface: marketing (heroes, feature rows/spotlight, testimonials, FAQ, pricing, newsletter, CTA, changelog timeline, chart-line sparkline, the minimal-set family), app (stat grid, data table, empty state, paywall-gate, data-viz bars/donut/metric-trend, choice pills, OTP input, skeleton, tooltip), and chrome (site-header, site-footer, prose-page). Every block uses theme tokens only — no hardcoded colors — so the whole set re-skins with the visitor's color pack.",
      "Blocks are registered in src/kit/blocks.ts. The dev-only /kit-blocks route browses the registered set live and returns 404 in production; ThemePicker in Settings → Appearance previews the same token axes on real controls.",
    ],
    "src/kit/blocks/\n  marketing/   heroes, pricing, faq-accordion, testimonial-grid, cta-* …\n  app/         stat-grid, data-table, empty-state, paywall-gate, data-viz-* …\n  chrome/      site-header, site-footer, prose-page\n\n// Register a new block in src/kit/blocks.ts, then it appears on /kit-blocks",
    [
      "Compose product pages from blocks first; write a new block only when a needed pattern is missing. New blocks follow the same shape: a .tsx plus a .module.css that reads var(--page|--section|--raised|--text|--muted|--border|--accent) tokens, no hex literals.",
      "The minimal marketing family (product-frame, hero-product, steps-ruled, feature-story, comparison-ruled, pricing-panel, faq-split, cta-form) implements the minimal pack grammar — white paper, hairline rules, pill actions. Below-fold sections may opt into the scroll-reveal block, a once-only entrance gated on prefers-reduced-motion that fails open for no-JS.",
    ],
    [
      "Open /kit-blocks in development and flip through Density/Radius/Font and the color packs in Settings → Appearance — every block should re-skin without edits. Run the contrast test when adding a pack; check blocks at 320–390px and with reduced motion before shipping a page built from them.",
    ],
  ),
  guide(
    "modules/public-api",
    "modules",
    "Identity and access",
    "Public REST API and API keys",
    "Give workspace integrations a scoped, key-authenticated surface alongside the app.",
    [
      "The /api/v1 surface accepts Authorization: Bearer sk_… API keys issued per workspace (Settings → Developers) with read or write scopes; cookie sessions also resolve, but keys are the integration path. Missing or invalid keys get a 401 with a Bearer challenge, and every route shares the v1 rate limiter.",
      "GET /api/v1/openapi returns the OpenAPI document for the surface — hand it to clients, codegen, or the machine-readable docs instead of maintaining a separate contract.",
    ],
    "GET  /api/v1/workspaces/current\nGET  /api/v1/entitlements\nGET  /api/v1/models/requirements\nPOST /api/v1/ai-tasks\nGET  /api/v1/ai-tasks/{taskId}\nGET  /api/v1/ai-tasks/{taskId}/result\nGET  /api/v1/openapi\n\nAuthorization: Bearer sk_...\nIdempotency-Key: <stable key>   # on POST /api/v1/ai-tasks",
    [
      "Task creation is entitlement-gated and idempotent — a repeated Idempotency-Key returns the saved task instead of duplicating work, and changed input under the same key conflicts rather than silently writing. Workspace resolution comes from the key, never from a client-supplied workspaceId.",
      "The same sk_ keys and scopes power the /api/mcp endpoint — a read-scoped key sees only read tools there too. One credential surface, two transports (REST and MCP), identical authorization.",
    ],
    [
      "Verify a read-scoped key is denied on write endpoints, an unscoped request gets 401 even with a valid session cookie absent, and a foreign-workspace key cannot read another workspace's tasks. Fetch /api/v1/openapi after adding routes to confirm the published contract grew with them.",
    ],
  ),
  guide(
    "web/seo-public-pages",
    "web",
    "Development",
    "SEO for public pages",
    "Keep metadata, canonicals, sitemap, and structured data in sync when adding public routes.",
    [
      "Every indexable route exports metadata or generateMetadata with a unique title and description; the root layout's title.template appends the brand, so page titles stay bare ('FAQ', not 'FAQ | supastack'). Set alternates.canonical on each indexable page so filter/query variants collapse to the canonical path.",
      "Docs guides, blog posts, and other collection pages reach the sitemap automatically through the content collections; standalone public pages must be added to marketingStaticPaths and STATIC_ENTRY_META in src/marketing/marketing-sitemap.ts — extend marketing-sitemap.test.ts with the new entry.",
    ],
    "export const metadata: Metadata = {\n  title: 'Changelog',                    // bare — template adds the brand\n  description: '…150–160 chars…',\n  alternates: { canonical: '/changelog' },\n};\n\n// Structured data comes from the builders in src/marketing/seo.tsx —\n// render <JsonLd> in the component that shows the content,\n// never a hand-written <script> tag.",
    [
      "Locale-prefixed pages set alternates.languages plus x-default via homeLanguageAlternates(). Organization and WebSite schema live in the root layout; render FAQPage, BlogPosting, or BreadcrumbList from the component that displays that content. Keep /app-authenticated routes absent from the sitemap and disallowed in app/robots.ts, including localized mirrors.",
      "Social cards share apps/web/public/demo-social.png; pages that define their own social metadata must set openGraph.images and twitter.images explicitly because Next replaces the layout's whole object — pageSocialMetadata() is the override helper.",
    ],
    [
      "After adding a page: unique title/description → canonical → sitemap entry (plus test) → JSON-LD where a schema type fits → heading hierarchy and image alts. After deploying, fetch the page and image as Twitterbot and confirm both tags resolve to a public 200 image/png response.",
    ],
  ),
];
