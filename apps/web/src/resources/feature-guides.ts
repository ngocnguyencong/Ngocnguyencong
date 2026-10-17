import type { Guide, Section } from "./content";

const beginnerPrerequisites: Record<"web" | "mobile" | "desktop", string> = {
  web: "Prerequisites: Read the two beginner guides below, finish Web local setup, and open this monorepo at its root in your editor. Web settings belong in `apps/web/.env.local`; Next.js does not read the root `.env`. `/ai` in the default fake mode is a no-database demo; `/auth` needs a migrated database.",
  mobile:
    "Prerequisites: Read the two beginner guides below and finish Mobile local setup. Put Expo values in `apps/mobile/.env.local`; set `EXPO_PUBLIC_API_URL` to a backend host your device can reach. A mobile-only checkout has no web backend, so start or connect one separately. A successful Expo export proves the JavaScript bundle, not device or purchase acceptance.",
  desktop:
    "Prerequisites: Read the two beginner guides below and finish Desktop local setup, including Rust and operating-system prerequisites. The code block starts both the web app and Tauri in the monorepo; in a desktop-only checkout, use its filtered command only after starting a reachable web backend separately. Tauri loads that backend.",
};

const beginnerAgentPrompt =
  "For custom code, start with the supplied `prompts/README.md` and copy the closest prompt: `prompts/new-app-screen.md` for an app screen or `prompts/new-landing-page.md` for a public page. For server, database, or provider work, give your coding agent this guide's task and ask it to read `AGENTS.md`, `.ai/PROJECT_CONTEXT.md`, and matching `.ai/` mirrors; inspect the exact source files named here; list files and checks before editing; preserve workspace ownership and server-only secrets; and show you the diff. Tell it the behavior you want, input and output fields, allowed roles, expected success and errors, and the test account, provider, or device. Use sample values; never paste a real secret.";

const beginnerGlossary =
  "Quick terms: a workspace is one team's separate users, data, and settings. The server is the trusted backend; keep provider keys out of browser and phone code. A migration is a versioned database change that creates or updates tables. An AI model is the engine that answers; the model catalog is the server's list of available model IDs and prices. A provider is an outside service such as an AI, email, or billing service. An entitlement is a grant that lets a workspace use a feature. A webhook is a message one service sends to another service's URL.";

const beginnerPlatformCode: Partial<Record<"web" | "mobile" | "desktop", string>> = {
  desktop:
    "# Monorepo: start the web app and desktop shell together\ncorepack pnpm dev:desktop\n\n# Desktop-only checkout: start Tauri after a web backend is already reachable\ncorepack pnpm --filter @supastack/desktop dev",
};

const beginnerCommandBlocks: Readonly<Record<string, string>> = {
  "modules/authjs": "corepack pnpm --filter @supastack/web dev",
  "modules/email-otp": "EMAIL_PROVIDER=local",
  "modules/workspace-credits":
    "corepack pnpm --filter @supastack/db db:migrate\ncorepack pnpm --filter @supastack/web dev",
  "modules/push-notifications":
    "# Terminal 1 — Web API (from the monorepo root):\ncorepack pnpm --filter @supastack/web dev\n\n# Terminal 2 — Expo app (from the monorepo root):\ncorepack pnpm --filter @supastack/mobile start",
  "modules/site-analytics": "ANALYTICS_PROVIDER=local",
  "modules/schedules": "corepack pnpm jobs:tick",
  "modules/email-templates": "corepack pnpm --filter @supastack/web dev",
  "modules/marketing-forms": "corepack pnpm --filter @supastack/web dev",
  "marketing/public-pages": "corepack pnpm --filter @supastack/web dev",
  "web/guided-setup":
    "corepack pnpm setup\n\n# Validate the machine without writing anything\ncorepack pnpm setup -- --check",
  "desktop/distribution":
    "corepack pnpm --filter @supastack/desktop typecheck\ncorepack pnpm --filter @supastack/desktop test\ncorepack pnpm --filter @supastack/desktop check:release-config\ncorepack pnpm --filter @supastack/desktop build",
  "deploy/docker":
    "docker compose up -d postgres\ncorepack pnpm --filter @supastack/db db:migrate\n\n# Optional local object-storage profile\ndocker compose --profile storage up -d",
  "deploy/managed-hosting":
    "corepack pnpm install\ncorepack pnpm --filter @supastack/web build\n\n# Local production-mode smoke test, not a deployment\ncorepack pnpm --filter @supastack/web start",
  "security/health": "corepack pnpm --filter @supastack/web dev",
};

const beginnerActions: Readonly<Record<string, string>> = {
  "tutorials/protected-page":
    "1. Open VS Code at the repository root and ask your coding agent to create `apps/web/app/reports/page.tsx` and `apps/web/src/reports.ts`. Give it the report fields and allowed roles; require server-side membership checks and a query filtered by `workspaceId`. 2. Open `/reports` as a signed-in member and confirm only that workspace's records appear. 3. Try a signed-out and a second-workspace account; if either can read the records, stop and fix the server check.",
  "tutorials/first-ai-task":
    "1. Open `/ai` in the default development setup. Click “Start local reference flow” first. In the ReferenceApp demo, click “Queue local task,” then “Run local task,” then “View result”; expect the local result to appear. 2. This demo uses `/api/local-reference` and makes no real AI-provider, billing, or email call. 3. Durable `POST /api/ai/tasks` is a separate signed-in flow that needs a migrated database, an enabled catalog model and price, workspace model policy, an active entitlement, and Trigger.dev. Give your agent the task in this guide before attempting that custom setup.",
  "tutorials/paid-content":
    "1. In `apps/web/src/product-plans.ts`, keep the shipped example key `ai.reference-task`; in `/content`, create a test entry, set `required_entitlement` to that exact value, save, and publish. 2. Open it from a test workspace without that grant: only the teaser should appear. 3. If the full body appears, gate the server query too. Use a billing sandbox for grant tests; do not start a live checkout.",
  "tutorials/landing-page":
    "1. Open `prompts/new-landing-page.md` and provide the page goal, audience, CTA destination, proof points, and image assets. 2. Ask your agent to compose `site-header`, a hero, feature rows, pricing or FAQ, CTA, and `site-footer` from `apps/web/src/kit/blocks/`. 3. Review the route at 320px and with a keyboard; send forms only to a test destination. If colors drift, choose a `STYLE_CATALOG` style instead of hardcoding colors.",
  "web/guided-setup":
    "1. Open a terminal at the root of your fresh clone. Install Node.js 22 or newer first if the machine does not have it; the repository pins pnpm through Corepack. 2. Run `corepack pnpm setup` — or `node scripts/setup.mjs` when pnpm is not on PATH yet — and follow the prompts: the wizard checks the toolchain, bootstraps `.env` files from `.env.example` without printing secrets, offers `corepack pnpm install`, and can run migrations when Postgres is up. 3. When it finishes, run the dev command it prints and open `http://localhost:3000`. Re-run the wizard any time — it detects completed steps, and `corepack pnpm setup -- --check` validates the machine without writing.",
  "modules/authjs":
    "1. In `apps/web/.env.local`, set `AUTH_PROVIDER=authjs` and add a test `AUTH_SECRET`; keep secrets on your machine. 2. From the repository root, restart the Web development server using the command below, then open `/auth` against a migrated local database and test sign-in and sign-out. 3. Expect an Auth.js session; OTP, two-factor, and passkeys do not transfer automatically. If the database or secret check fails, finish Web database setup or remove `AUTH_PROVIDER` to return to the default engine.",
  "modules/email-otp":
    "1. Finish Web local setup with a migrated database. Put the line shown below in `apps/web/.env.local`, then restart the Web development server and request an email code at `/auth` using a test account. 2. Open `http://localhost:3000/mail-preview` and copy the newest code from the local outbox into the sign-in screen. This local provider creates a real auth code for the app but does not send an inbox email. 3. If no message appears, check that the database is migrated and request a fresh code; never paste a code into chat.",
  "modules/two-factor":
    "1. Sign in with a test account, open Settings → Security, choose “Enable TOTP 2FA,” and finish the authenticator challenge. 2. Save recovery codes privately, then sign out and back in to confirm the challenge appears before workspace access. 3. If the option is missing, confirm Better Auth is the active engine; Auth.js does not include this plugin.",
  "modules/passkeys":
    "1. Set `APP_URL` to one stable origin in `apps/web/.env.local`, restart the app, sign in, and open Settings → Security. 2. Choose “Add passkey” and approve the browser or device prompt, then sign in with it. 3. Expect the passkey in the settings list. If no prompt appears, use the same HTTPS or localhost origin and a supported browser; keep another sign-in method enabled.",
  "modules/sessions":
    "1. Sign in to `/auth` in two test browser sessions, then sign out from one session. 2. Request a protected page from the signed-out session; the server should require sign-in. This guide covers session behavior, not a cross-device session-revocation screen. 3. To inspect your own data export, use `GET /api/account/export`; it must not include another user's or workspace's private records.",
  "modules/entitlements":
    "1. In `apps/web/src/product-plans.ts`, read the plan's `entitlement` value; `ai.reference-task` is the shipped example. 2. Set a test content entry's `required_entitlement` to that same key and compare a workspace without the grant to one with a verified test grant. 3. The locked workspace must not receive the body from the server. A hidden button alone is not access control; use only a billing sandbox for grant tests.",
  "modules/product-plans":
    "1. Open `apps/web/src/product-plans.ts` and edit a test plan's stable ID, display name, and entitlement; change the label without changing the ID. 2. In the selected provider's server settings, map its sandbox product or price ID to the monthly or yearly key listed in Environment variables. 3. Test with sandbox checkout. If yearly checkout fails, add the matching yearly ID; never use a live price ID for a test.",
  "modules/workspace-credits":
    "1. Run the migration command below against your local database, sign in with a test account, and open `/billing`; the workspace credits card shows the balance and the newest ledger entries. 2. Add your test address to `ADMIN_EMAILS`, restart the app, sign in as that platform admin, open `/admin/organizations`, and use the Grant credits form on the test workspace; the billing card then shows a `grant` entry and the new balance. 3. Spending is automatic once a plan sets `usageLimits` and `creditGrant` in `apps/web/src/product-plans.ts`; ask your coding agent to configure a tiny test limit, run AI requests past the quota, and confirm `debit` entries appear. Never use a real payment or a production workspace for this check.",
  "modules/usage-controls":
    "1. Sign in as a workspace owner or admin and open Settings → Usage; set a small monthly AI budget and a cap on one meter, then Save. 2. Sign in as an ordinary member and open the same page — the values are visible but the save controls do not apply; the mobile billing screen reads the same counters through `GET /api/mobile/usage`. 3. Ask your agent to register a test meter in `USAGE_METERS` in `apps/web/src/usage-meters.ts` and confirm it gets its own cap control; caps are hard ceilings and prepaid credits only spend above the plan allowance.",
  "modules/chat":
    "1. Open `/chat` in a signed-in test workspace and start a test conversation. 2. Submit a harmless prompt; on Expo, also try Stop once. 3. Expect a saved thread and a completed answer or safe provider error. If no model is eligible, ask your agent to inspect the server model catalog, supported capabilities, workspace policy, and budget before changing credentials.",
  "modules/byok":
    "1. This is a coding task, not a setup screen to guess. Ask your agent to inspect `apps/web/src/byok-key-vault.ts`, its tests, and `apps/web/src/agent-runtime.ts`; have it report where workspace key management exists before suggesting UI steps. 2. Before a local test key can be saved, put a stable 32-byte base64 `CREDENTIAL_ENCRYPTION_KEY` in the server-only local secret store. Provide the agent a fake/test provider key and the allowed workspace roles; never paste a real or raw key into client settings or chat. 3. Ask it to test save, remove, restart/decrypt, and denial from a second workspace. The screen should show provider status only, never key text.",
  "modules/model-catalog":
    "1. There is no model-catalog admin page in this starter. Ask your coding agent to inspect `apps/web/src/ai-model-catalog.ts`, `apps/web/src/ai-model-catalog.test.ts`, `packages/db/src/schema.ts`, `packages/db/drizzle/`, `apps/web/src/ai-task-runtime.ts`, and `packages/ai/src/router.ts`; trace how the existing store writes model rows and effective-dated prices before proposing a change. 2. Provide the real provider model ID, provider name, supported capabilities, input/output price rates with currency and effective date, and the alias you want (for example, `fast`). Ask the agent to add/update the model and price through the existing store and tests, then show the files changed; do not invent prices or seed production models. 3. After review, test one harmless prompt in a local workspace with the model enabled and allowed by workspace policy. If routing rejects it, inspect model ID, capabilities, price date, policy, entitlement, and budget; do not paste provider credentials into chat.",
  "modules/workspace-tools":
    "1. Open `apps/web/src/workspace-tools.ts` and ask your coding agent to add a snake_case `defineTool` entry with a named input schema and `read` or `write` scope. Tell it what fields the tool accepts and returns; never let the model choose `workspaceId`. 2. Test valid input, malformed input, and a caller without write scope. 3. Expect a safe denial for bad access; if a foreign record appears, add the ownership filter before using the tool.",
  "modules/schedules":
    "1. Open Settings → Developers and use the Schedules controls to create a test job with a UTC run time. 2. Keep the app running and make the same server-only `SCHEDULER_TICK_SECRET` available to the app and terminal; run the command below from the repository root. 3. Confirm the due time advances and the job reaches its own status. If nothing runs, check the UTC time, scheduler provider, and server logs; never paste the secret into chat.",
  "modules/email-templates":
    "1. From the repository root, run the Web development command below and open `http://localhost:3000/mail-preview`. 2. Inspect the subject, text version, links, brand, and long translated copy. 3. The local preview/outbox does not send inbox mail. If the page is 404, confirm you are in development rather than production.",
  "modules/storage":
    "1. For a no-credential trial, keep `STORAGE_PROVIDER=memory`. If this checkout has no visible upload control, ask your coding agent to inspect `apps/web/app/api/storage/avatar/route.ts`, `apps/web/app/api/storage/logo/route.ts`, `apps/web/app/api/storage/organization-logo/route.ts`, and the matching settings page before wiring a small sample image. 2. To check persistence, set `STORAGE_PROVIDER=s3`, `STORAGE_REGION`, and `STORAGE_BUCKET` in `apps/web/.env.local`, add server-only test credentials locally, and restart. 3. The image should reload from storage. Memory files disappear when the process restarts; for S3 errors, check bucket, endpoint, and access policy.",
  "modules/content":
    "1. Sign in as a workspace owner or admin, open `/content`, and use the form to create a post, page, doc, or report with a unique slug. Save it as a draft, then publish it. 2. Confirm the status changes to published; a duplicate slug or member without management access should fail. 3. For a gated test, use `required_entitlement=ai.reference-task`; without a verified grant, the page must show only its teaser.",
  "modules/commerce":
    "1. As a workspace owner or admin, open `/commerce` and use the product form to create a draft with a name, currency, integer minor-unit price, and optional tracked stock (for USD, `1299` means $12.99). 2. Activate it and create a local test order; confirm the server calculates the total and stores the product snapshot. 3. Do not connect a live payment provider or charge a real buyer. If an order cannot advance, check available stock and the documented order state before retrying.",
  "modules/notifications":
    "1. Sign in as a test member and open Settings → Notifications to review the available channel preferences. 2. Use two test members in one workspace and trigger a local test event, such as an invite, with `EMAIL_PROVIDER=local`. 3. Confirm only eligible members and enabled channels receive a notification in the app or local outbox. Do not send test messages to real members.",
  "modules/push-notifications":
    "1. Follow Mobile local setup with the Web backend running, and open the app on a physical device or a development build — Expo Go and simulators cannot finish push registration. 2. Sign in to a test workspace, grant the notification permission when asked, and open Settings → Notifications to confirm the device push state is enabled. 3. Trigger a workspace event such as an invite from a second test account and expect the notification on the device. If nothing arrives, check the permission state and the Expo project id; push is best-effort and never replaces the in-app notification.",
  "modules/connected-accounts":
    "1. Create a test OAuth app and register the callback matching `APP_URL`, such as `{APP_URL}/api/accounts/google/callback`; place its client ID and server secret under the matching `CONNECTED_GOOGLE_*` keys. 2. In Settings → Connections, connect a test account and then disconnect it. 3. Expect a connected status without token text. For callback errors, compare hostname, port, provider, and callback path; never share token values.",
  "modules/webhooks":
    "1. In Settings → Developers, create a test endpoint at a receiver you control, select only the events needed, and save its signing secret in the receiver's secret store. 2. Send a test event and inspect its delivery history; the receiver should verify the signature and deduplicate the event ID. 3. Expect a successful response. If it retries, inspect the receiver status and correlation ID; never paste the signing secret into chat.",
  "modules/feedback":
    "1. Open `/feedback` as a workspace member, submit one specific request, and vote once. 2. Sign in as the workspace owner or admin, open that request, and change its status from open to under_review. 3. The vote count should increase only once and the status badge should update. If management controls are missing, confirm your workspace role; platform admin is not required.",
  "modules/appearance-sync":
    "1. Sign in on web, open Settings → Appearance, and change the color pack or one axis; the bundle persists through `PUT /api/account/appearance`. 2. On a second browser profile or the mobile app, choose “Match web app” (or sign in and reload) and confirm the same theme applies; the newest `updatedAt` bundle always wins. 3. Turn off the network on mobile — recently loaded screens keep the synced palette and readable data from the scoped offline cache. An unsigned-in visitor never receives another user's bundle.",
  "modules/admin":
    "1. Before creating a local test account, add your own address to the server-only `ADMIN_EMAILS` list and restart the app. 2. Sign up on the migrated test database and open `/admin`; inspect the available user and organization pages. 3. This grants platform admin, not workspace ownership. If access is denied, verify the exact email and server configuration; do not elevate arbitrary users or test against production.",
  "modules/feature-flags":
    "1. Sign in as a platform admin and open `/admin/flags`; create or select one test flag and set it explicitly to enabled, then disabled. 2. Refresh the product surface that reads the flag and confirm its presentation changes. 3. Roles and entitlements must still protect server actions when a flag is enabled. If the API remains accessible while disabled, add a server-side flag check where intended.",
  "modules/announcements":
    "1. As a platform admin, open `/admin/announcements`, create a short test announcement, save it hidden, then publish it. 2. Open the app as an ordinary member and confirm only the published item appears. 3. If a workspace admin can edit platform announcements, stop and correct the role boundary; announcement reading is separate from notification preferences.",
  "modules/waitlist":
    "1. Open the public waitlist form and submit a controlled test address; confirm it enters the waiting state. 2. As a platform admin, open `/admin/waitlist`, issue a code bound to that address, and test signup with the correct and a different address. 3. Expect waiting → invited → joined. If mail is not received, check configured transactional email; local mode does not deliver.",
  "modules/referrals":
    "1. Submit a controlled address to the waitlist form and copy its generated `/?ref=CODE` share URL. 2. Open that URL in a private browser and submit a different test address. 3. Confirm one referral is recorded; opening it repeatedly must not add duplicates, and using your own code must not count. Do not include private email addresses in the share URL.",
  "modules/marketing-forms":
    "1. In `apps/web/.env.local`, set `MARKETING_INBOX` to a test address you control and set `MARKETING_LEAD_STORE=local`; keep email delivery local. From the repository root, start Web with the command below. 2. Submit the contact or newsletter form using a test address. 3. Expect a success state and a local lead record; local email does not deliver to an inbox. If submission is rejected, check validation, rate limit, and CAPTCHA configuration before retrying.",
  "modules/site-analytics":
    "1. Put the line shown below in `apps/web/.env.local`, restart the Web development server, and make sure your local database is migrated. 2. Open the public site in a private window: before you accept the consent banner, no collect request fires; after accepting, each page navigation sends a pageview. 3. Sign in as a platform admin and open `/admin`; the Site analytics card counts the last 30 days of pageviews, visitors, and events. If the card is missing, confirm `ANALYTICS_PROVIDER=local` and your admin role — the card renders for real admins only.",
  "web/branding":
    "1. Open `apps/web/src/marketing/site-config.ts` and change the product name, tagline, navigation labels/URLs, and support address to values you own. 2. Replace `apps/web/public/demo-social.png` and update its alt text and dimensions in `apps/web/src/marketing/seo.tsx` as one change. 3. Refresh the home, FAQ, footer, and social preview. If old text remains, search this repo for the old name before publishing.",
  "web/layouts":
    "1. Sign in and open Settings → Appearance. Choose a named design style, then try one available density or layout option. 2. Open `/dashboard` and confirm the workspace shell changes while page content remains readable. 3. If you want a custom style, ask your coding agent to edit `apps/web/src/theme/styles.ts` and `apps/web/app/app-theme.css`, then check keyboard use and a narrow screen.",
  "web/agent-prompts":
    "1. At the repository root, open `prompts/README.md` and choose the file that matches your task: `pick-a-style.md`, `new-landing-page.md`, `new-app-screen.md`, `restyle-product.md`, or `ui-audit.md`. 2. Give the agent the target route, audience, desired behavior, examples, and required roles; ask it to read `AGENTS.md` and `.ai/PROJECT_CONTEXT.md` first. 3. Review its exact file list and preview. If it proposes publishing or a paid call, keep that as a separate step.",
  "web/legal-pages":
    "1. Open `apps/web/src/marketing/legal-content.ts` and replace sample policy text, dates, contact details, and product claims with your product's reviewed values. 2. Check `/privacy`, `/terms`, `/legal/acceptable-use`, `/legal/disclaimer`, and `/legal/license`, then confirm footer links still open. 3. If a route is missing from search metadata, update canonical/sitemap data too; implementation checks do not approve legal wording.",
  "marketing/public-pages":
    "1. Start the Web app, then open `/changelog`, `/roadmap`, and `/api-reference` in the browser; each is a public page that needs no sign-in, and each has a localized mirror such as `/fr/changelog`. 2. To add a release note, open `apps/web/src/marketing/changelog-entries.ts`, copy the newest entry's shape, and put your entry first with a unique ISO date and one shipped capability per bullet. 3. Reload `/changelog` and confirm the entry renders at the top. Keep entries factual — describe what shipped, not internal fixes — and replace the demo list with your own product's notes before launch.",
  desktop:
    "1. Follow Desktop local setup, then open the app in the Tauri window and sign in to the same web account you use in a browser. 2. Visit a workspace page, hide/show the window from the tray, and try the summon shortcut. 3. The screen should match the web app because Tauri loads the configured backend. If it shows a can't-reach screen, confirm that `SUPASTACK_APP_URL` points to a reachable running web app, then retry.",
  "desktop/native-behavior":
    "1. Open `apps/desktop/src-tauri/src/lib.rs`; ask your agent to change only the named window/tray/hotkey behavior and keep product UI in the web app. 2. Run the shell and test close-to-tray, Quit, and `CmdOrCtrl+Shift+Space`; test `supastack:///settings/appearance?preview=1#main`. 3. It should focus the existing window and preserve path/query/fragment. If it opens the wrong page, compare the configured origin and exact route.",
  "desktop/distribution":
    "1. In a local branch, ask your coding agent to inspect `apps/desktop/src-tauri/tauri.conf.json` and set the product identifier, app name, icons, and backend URL to values you own. Use a public HTTPS backend URL for release builds. 2. From the repository root, run the Desktop package checks below. Before check:release-config, set SUPASTACK_APP_URL in this terminal using the operating-system command in Desktop local setup; the public HTTPS backend must be running, and the app identifier must be your own. 3. A successful build does not sign, notarize, or publish an installer; if Rust or a system library is missing, finish Desktop local setup.",
  "mobile/api-surface":
    "1. In `apps/mobile/.env.local`, set `EXPO_PUBLIC_API_URL` to the running backend address reachable from your phone; do not use `localhost` from a physical device. 2. Follow Mobile local setup to start Expo, sign in, and open workspace, settings, and chat screens. 3. Expect authenticated data from the same workspace. If requests time out, check the phone and computer network and start the backend separately in a mobile-only checkout.",
  "deploy/docker":
    "1. From the repository root, run the local Postgres and migration commands below. 2. If you want to test object storage, run the optional storage command in the same block and use only sample uploads. 3. Expect the database container to be running and migrations to finish. If its port is occupied, stop the conflicting local database and retry; do not delete the volume to fix a connection error.",
  "deploy/managed-hosting":
    "1. From the repository root, use the commands below to build and run a local production-mode Web server. 2. For a future hosting task, give your agent the host name, supported runtime, database choice, and provider list; ask for a reviewable configuration plan and stop before deployment or billing. 3. A local build does not prove provider callbacks or production behavior. If the local server fails, check the safe error and migration state without printing environment files or secrets.",
  "security/workspace-isolation":
    "1. In the server action or route that reads a user-owned record, resolve the signed-in user's membership and active `workspaceId` before querying. 2. Ask your agent to add one allowed-member case and one foreign-workspace denial for the exact record path; provide the roles and fields involved. 3. The first request should succeed and the second should return no record/access denied. If changing only the button hides access but direct requests still work, the server boundary is missing.",
  "security/rate-limiting":
    "1. In the server environment, choose `RATE_LIMIT_STORE=postgres` for shared production buckets and set `PUBLIC_AI_DAILY_BUDGET_MICROUNITS=0` to keep public AI disabled. 2. Set `TRUSTED_PROXY_COUNT` only to the exact number of controlled proxies that append forwarding headers; do not copy `1` unless that is true for your host. 3. Verify a denied request returns a retry-safe error. If limits differ across instances, check they share Postgres.",
  "security/turnstile":
    "1. Create a Turnstile test widget for the exact local/deployed hostname. In `apps/web/.env.local`, set `CAPTCHA_PROVIDER=turnstile` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; put `TURNSTILE_SECRET_KEY` only in the server secret store. 2. Restart and submit a test contact form. 3. Expect the challenge and a successful valid-token response. If every request fails, compare hostname and key pair; never expose the secret key.",
  "security/secrets":
    "1. Keep public values such as `NEXT_PUBLIC_TURNSTILE_SITE_KEY` separate from provider keys, database passwords, webhook secrets, and encryption keys. 2. Put real secrets in the server secret store or local `apps/web/.env.local`; never put them in `NEXT_PUBLIC_`/`EXPO_PUBLIC_` variables, source, screenshots, or agent chat. 3. If a secret was exposed, rotate it at the provider and update the server store; deleting the visible line alone is not enough.",
  "security/privacy":
    "1. Sign in as a test user and request `GET /api/account/export`; inspect the downloaded export for that user's records. 2. If adding a user-owned table, ask your agent to include its rows in the export and define retention/removal behavior; provide the table name, owner key, and sensitive fields. 3. Stop if the export includes another workspace's records or any provider secret; a passing export is not legal certification.",
  "security/health":
    "1. From the repository root, start Web with the command below, then open `http://localhost:3000/api/health` and `http://localhost:3000/status` in a browser. 2. Expect a health response and public status page. 3. If health returns an error, use the app's server log and request/correlation ID to find the failing service. A green endpoint does not prove migrations, sign-in, provider callbacks, email delivery, or jobs.",
};

const beginnerSetupLinks = {
  web: { href: "/docs/web/local-setup", label: "Web local setup" },
  mobile: { href: "/docs/mobile/local-setup", label: "Mobile local setup" },
  desktop: { href: "/docs/desktop/local-setup", label: "Desktop local setup" },
} as const;

function feature(
  slug: string,
  group: string,
  title: string,
  description: string,
  sections: readonly Section[],
  tab: Guide["tab"] = "modules",
): Guide {
  const platform = tab === "modules" ? "web" : tab;
  const actions = beginnerActions[slug];
  const code = [
    slug === "desktop/distribution" ? undefined : beginnerPlatformCode[platform],
    beginnerCommandBlocks[slug],
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n\n");

  if (slug !== "desktop/local-setup" && !actions) {
    throw new Error(`Missing beginner walkthrough for ${slug}`);
  }

  const beginnerSection: Section[] = actions
    ? [
        {
          id: "beginner-walkthrough",
          title: "Beginner walkthrough",
          paragraphs: [
            beginnerPrerequisites[platform],
            beginnerGlossary,
            actions,
            beginnerAgentPrompt,
          ],
          ...(code ? { code } : {}),
          links: [
            { href: "/docs/web/before-you-start", label: "Before you start" },
            { href: "/docs/web/terminal-basics", label: "Terminal basics" },
            beginnerSetupLinks[platform],
            { href: "/docs/web/agent-prompts", label: "Agent prompts & project memory" },
          ],
        },
      ]
    : [];

  return { slug, tab, group, title, description, sections: [...beginnerSection, ...sections] };
}

export const featureGuides: readonly Guide[] = [
  feature(
    "tutorials/protected-page",
    "Tutorials",
    "Add a protected page",
    "Build a workspace-scoped page with session checks, role enforcement, and useful denied-access behavior.",
    [
      {
        id: "route",
        title: "Create the route",
        paragraphs: [
          "Add a page beneath `apps/web/app/`. Start from the dashboard or content route so you reuse its session and active-workspace resolution. A route exists when its folder contains `page.tsx`; use a Server Component for protected reads.",
        ],
        code: "apps/web/app/reports/page.tsx\napps/web/src/reports.ts\n.ai/apps/web/app/reports/page.md\n.ai/apps/web/src/reports.md",
      },
      {
        id: "authorize",
        title: "Resolve ownership on the server",
        paragraphs: [
          "Read the signed-in identity and active workspace through the existing auth/workspace helpers. Verify membership before loading records. Filter every query by the resolved `workspaceId`; never take an owner identifier from a form or model output.",
          "Check owner/admin permissions for management actions. When a feature is paid, check its entitlement at the read or action boundary before returning protected data; a hidden button does not enforce access.",
        ],
      },
      {
        id: "verify",
        title: "Verify access and recovery",
        paragraphs: [
          "Test anonymous access, a valid member, a member of another workspace, a revoked session, and the required role. Add empty and failed-load states with a recovery action. Keep the route out of the public sitemap and add its prefix to robots disallows.",
        ],
        links: [
          { href: "/docs/security/workspace-isolation", label: "Workspace isolation" },
          { href: "/docs/modules/entitlements", label: "Entitlement checks" },
        ],
      },
    ],
    "web",
  ),
  feature(
    "tutorials/first-ai-task",
    "Tutorials",
    "Run your first AI task",
    "Try the zero-database local reference demo, then learn what durable paid workspace tasks require.",
    [
      {
        id: "prepare",
        title: "Start with the local flow",
        paragraphs: [
          "The `/ai` screen in the default development setup shows a ReferenceApp demo that runs without a database or provider credentials. Keep the fake/local providers for this first trial. Durable workspace tasks use the separate task API and require a migrated database, an enabled catalog model and effective-dated price, workspace model policy, an active entitlement, and Trigger.dev.",
        ],
        code: "AI_PROVIDER=fake\nJOB_PROVIDER=local\nEMAIL_PROVIDER=local\nBILLING_PROVIDER=local",
      },
      {
        id: "submit",
        title: "Submit once and retain the recovery key",
        paragraphs: [
          "The durable signed-in task endpoint is `POST /api/ai/tasks`; it is not the no-database ReferenceApp demo. Use it only after the prerequisites above are running. Follow its request body and save a 16–128 character `Idempotency-Key` before sending. Use `GET /api/ai/tasks/{taskId}` for saved status; API-key clients use the separate `/api/v1/ai-tasks` contract.",
          'After a lost response, reuse the original key with `{ "resume": true }`. Changed input under the same key returns a conflict. An ambiguous 202 response means dispatch is uncertain; it does not establish job completion.',
        ],
      },
      {
        id: "production",
        title: "Configure the durable runtime",
        paragraphs: [
          "For a future durable-task implementation, ask your coding agent to use a test provider and Trigger.dev setup, register the `ai.generate` task, and configure reviewed prices and allowed aliases. Inspect result and usage separately from email. Test exhausted budgets, denied access, and uncertain enqueue locally before deciding whether to prepare a deployment.",
        ],
        links: [
          { href: "/docs/modules/ai-configuration", label: "Providers and model policy" },
          { href: "/docs/modules/task-recovery", label: "Submission and recovery" },
          { href: "/docs/modules/jobs", label: "Trigger.dev jobs" },
        ],
      },
    ],
    "web",
  ),
  feature(
    "tutorials/paid-content",
    "Tutorials",
    "Publish paid content",
    "Connect a product plan to a workspace entitlement, a published CMS entry, and a server-authorized reading surface.",
    [
      {
        id: "plan",
        title: "Choose the entitlement key",
        paragraphs: [
          "`apps/web/src/product-plans.ts` defines the plans and the entitlement each grants. The kit uses `ai.reference-task` on pro and lifetime. Use the same machine key in the plan, content entry and gate; the displayed plan name is not the authorization key.",
        ],
      },
      {
        id: "publish",
        title: "Publish a gated entry",
        paragraphs: [
          "Open `/content` as an owner/admin, create a post, page, doc or report, set its `required_entitlement`, and publish it. Public readers keep teaser metadata while the protected body is empty for a locked workspace. Server-only `content-queries.ts` owns the authorized reads; reuse that boundary in your product's page.",
        ],
      },
      {
        id: "check",
        title: "Test payment and reading together",
        paragraphs: [
          "Verify a free entry, a paid workspace, an unpaid workspace and another workspace's entry. The verified billing webhook grants access through the ledger; a checkout return URL must never unlock the content.",
        ],
        links: [
          { href: "/docs/modules/content", label: "CMS and gated content" },
          { href: "/docs/modules/billing", label: "Billing lifecycle" },
          { href: "/docs/components/paywall-gate", label: "Paywall gate block" },
        ],
      },
    ],
    "web",
  ),
  feature(
    "tutorials/landing-page",
    "Tutorials",
    "Build a product landing page",
    "Compose a branded public page from the block library, choose a style, and keep metadata, forms, and accessibility in sync.",
    [
      {
        id: "style",
        title: "Choose your product's look",
        paragraphs: [
          "Pick a complete style from `STYLE_CATALOG`, then decide whether marketing follows the visitor's pack or pins a product pack through `MARKETING_THEME_MODE`. The kit's default is Obsidian black; derived products choose their own brand.",
        ],
        links: [
          { href: "/docs/web/theming", label: "Themes and styles" },
          { href: "/docs/web/branding", label: "Branding" },
        ],
      },
      {
        id: "compose",
        title: "Compose real content",
        paragraphs: [
          "Start with `site-header`, a hero, feature rows or grid, pricing, FAQ, CTA and `site-footer`. Copy each block's TSX/CSS pair and supply your own copy and assets. Use the minimal family when you want ruled paper layouts; `product-frame` is its elevated surface. The blocks are presentation components; connect forms and checkout to your server actions.",
        ],
      },
      {
        id: "finish",
        title: "Verify the public route",
        paragraphs: [
          "Add a unique title/description, canonical, sitemap entry and matching JSON-LD. Check headings, mobile layout, keyboard access, readable contrast, reduced motion and no-JS content. Configure sender identity and bot protection before accepting leads.",
        ],
        links: [
          { href: "/docs/web/kit-blocks", label: "Block library" },
          { href: "/docs/web/seo-public-pages", label: "Public-page SEO" },
          { href: "/docs/modules/marketing-forms", label: "Contact and newsletter forms" },
        ],
      },
    ],
    "web",
  ),
  feature(
    "web/guided-setup",
    "Getting started",
    "Guided setup command",
    "Run the interactive first-run wizard that checks the toolchain, bootstraps environment files, offers migrations, and prints the next steps.",
    [
      {
        id: "wizard",
        title: "One command for first run",
        paragraphs: [
          "`pnpm setup` runs `scripts/setup.mjs` — a zero-dependency wizard for a fresh checkout. It checks the Node version against the engines floor, probes Corepack and the pinned package manager, detects an existing `node_modules` and offers `corepack pnpm install`, then bootstraps `.env` files from `.env.example` through the shared `setupEnvironment` helper — existing secrets are never overwritten or printed.",
          "The wizard ends with an optional `@supastack/db db:migrate` step, skipped by default with a Postgres-first hint, then prints the dev command and documentation pointers. It is safe to re-run: completed steps are detected, and Ctrl+C aborts cleanly.",
        ],
        code: "corepack pnpm setup",
      },
      {
        id: "check",
        title: "Validate without writing",
        paragraphs: [
          "`--check` (alias `--dry-run`) validates the toolchain and environment files without writing anything — the doctor-style pass for CI or a quick health check. `--yes` and non-TTY stdin take safe defaults: env bootstrap only, no dependency install, no migrations. `--skip-migrate` removes the migration offer entirely.",
          "Every spawned command is a fixed `corepack pnpm …` invocation — no shell-specific syntax, no system tools installed, no git state touched. `tests/setup.test.ts` covers flag parsing, wizard flows, and real spawned runs on fixture checkouts.",
        ],
        code: "corepack pnpm setup -- --check\n# or before pnpm is on PATH:\nnode scripts/setup.mjs --check",
      },
      {
        id: "verify",
        title: "When to reach for it",
        paragraphs: [
          "Use the wizard on a fresh clone instead of hand-copying env files. Coding agents and unattended environments keep the deterministic phases in `docs/agent-setup.md`; the wizard is the interactive human path over the same contracts.",
        ],
        links: [
          { href: "/docs/web/local-setup", label: "Set up locally in five minutes" },
          { href: "/docs/web/configuration", label: "Make and verify one configuration change" },
          { href: "/docs/web/troubleshooting", label: "Fix a first-run error" },
        ],
      },
    ],
    "web",
  ),
  feature(
    "modules/authjs",
    "Authentication",
    "Auth.js engine",
    "Select the Auth.js v5 adapter deliberately and understand which sign-in and session features differ from Better Auth.",
    [
      {
        id: "select",
        title: "Select the engine",
        paragraphs: [
          "Better Auth is the default full-feature engine. `AUTH_PROVIDER=authjs` selects the Auth.js v5 beta engine with JWT sessions and the shared user table. Existing credential sign-ins reuse stored password hashes; the same provider environment names configure social sign-in.",
        ],
        code: "AUTH_PROVIDER=authjs\n# Set AUTH_SECRET and configure enabled OAuth providers on the server.",
      },
      {
        id: "parity",
        title: "Keep the feature boundary explicit",
        paragraphs: [
          "Better Auth plugins supply Email OTP, magic links, 2FA, passkeys, admin impersonation/bans and Expo integration. These are not automatically available through the Auth.js engine. Check your required flows against the adapter before switching a deployed product.",
          "Review `apps/web/src/auth-runtime.ts` and the Auth.js runtime/service alongside `packages/auth`. Test organization provisioning and your onboarding path as part of the engine switch.",
        ],
      },
      {
        id: "verify",
        title: "Verify sessions and account linking",
        paragraphs: [
          "Exercise existing credentials, verified social identity, repeated callbacks, session expiry and sign-out. Never treat an email match without provider verification as permission to link accounts. Native Better Auth Expo flows need their own compatibility assessment.",
        ],
        links: [
          { href: "/docs/modules/auth", label: "Authentication overview" },
          { href: "/docs/mobile/authentication", label: "Native authentication" },
        ],
      },
    ],
  ),
  feature(
    "modules/email-otp",
    "Authentication",
    "Email OTP & magic links",
    "Configure passwordless sign-in through Better Auth and the transactional email boundary, including expired and repeated-code recovery.",
    [
      {
        id: "flow",
        title: "Use the shipped auth flow",
        paragraphs: [
          "The `/auth` surface supports Better Auth passwordless methods alongside credentials and OAuth. OTP and magic-link messages use the transactional email service. `EMAIL_PROVIDER=local` creates a real code/link in the development outbox at `/mail-preview` but does not send inbox mail; a separately configured email provider is needed for real delivery.",
          "Use the configured `APP_URL` as the origin for auth links. Do not accept arbitrary callback origins from a form. Review `packages/auth` and `apps/web/src/auth-runtime.ts` before changing plugin configuration.",
        ],
      },
      {
        id: "email",
        title: "Configure delivery",
        paragraphs: [
          "Select an `EMAIL_PROVIDER`, set `EMAIL_FROM`, and supply its server-only credentials only when you intentionally configure real delivery. The local adapter captures messages in the development outbox so you can copy a test OTP/link from `/mail-preview`; it does not deliver inbox mail. Turnstile can protect credential endpoints when enabled.",
        ],
        links: [
          { href: "/docs/modules/email-configuration", label: "Email configuration" },
          { href: "/docs/security/turnstile", label: "Bot protection" },
        ],
      },
      {
        id: "verify",
        title: "Test the return path",
        paragraphs: [
          "Check a valid code/link, invalid and expired values, a repeated request, opening a link on a different device, rate-limit recovery, and signed-out behavior. Never log OTPs, session tokens or full secret-bearing URLs.",
        ],
      },
    ],
  ),
  feature(
    "modules/two-factor",
    "Authentication",
    "Two-factor authentication",
    "Use the Better Auth two-factor plugin and settings security controls to enroll, challenge, recover, and disable an additional factor.",
    [
      {
        id: "setup",
        title: "Enroll through Security settings",
        paragraphs: [
          "The default Better Auth engine enables the two-factor plugin and the shared schema contains `two_factor`. Use the shipped settings security flow and auth client rather than implementing a second factor in product code.",
          "Review `apps/web/src/web-settings-security.ts` and the security settings panel. Auth.js does not inherit this Better Auth plugin.",
        ],
      },
      {
        id: "recovery",
        title: "Handle enrollment and recovery",
        paragraphs: [
          "Require the normal authenticated challenge for enrollment and disable actions. Present recovery material through the plugin flow and never send it to analytics, error context or logs. Keep the challenge screen distinct from a completed sign-in.",
        ],
      },
      {
        id: "verify",
        title: "Test factor enforcement",
        paragraphs: [
          "Verify enrollment, wrong and correct challenges, backup-code recovery and factor removal. Check that a partially completed login cannot access a protected workspace page.",
        ],
        links: [{ href: "/docs/modules/sessions", label: "Sessions and account security" }],
      },
    ],
  ),
  feature(
    "modules/passkeys",
    "Authentication",
    "Passkeys",
    "Configure the Better Auth passkey plugin on a trusted HTTPS origin and test enrollment, sign-in, and credential removal.",
    [
      {
        id: "origin",
        title: "Configure a consistent origin",
        paragraphs: [
          "Better Auth's passkey plugin uses WebAuthn with the `passkey` table. Configure `APP_URL` and the trusted origin before enrolling production credentials. Use an HTTPS deployment; local development has browser-specific localhost allowances.",
          "The security settings controls and auth client own the enrollment/removal flow. Review `packages/auth` and `web-settings-security.ts` for the configured relying-party boundary.",
        ],
      },
      {
        id: "domains",
        title: "Account for hostname boundaries",
        paragraphs: [
          "A passkey is associated with its relying party. Custom hostnames also have separate cookie sessions; do not promise cross-domain passkey sign-in or single sign-on without implementing and testing that behavior.",
        ],
      },
      {
        id: "verify",
        title: "Verify authenticators and fallback",
        paragraphs: [
          "Test enrollment, cancellation, existing-credential sign-in and removal in your target browsers/devices. Keep an enabled alternative sign-in method for account recovery. Browser tests with a virtual authenticator do not establish physical-device compatibility.",
        ],
        links: [{ href: "/docs/modules/custom-domains", label: "Custom domain boundaries" }],
      },
    ],
  ),
  feature(
    "modules/sessions",
    "Authentication",
    "Sessions & account security",
    "Manage active sessions, profile security, account export, and sign-out while preserving server-side authorization and safe secret handling.",
    [
      {
        id: "sessions",
        title: "Manage active sessions",
        paragraphs: [
          "Security settings expose the shipped session and credential controls through the selected auth engine. Revoking a session must invalidate server access, not only clear a local screen. Review `web-settings-security.ts`, the settings panels and auth runtime before extending them.",
        ],
      },
      {
        id: "export",
        title: "Export account data",
        paragraphs: [
          "The signed-in `GET /api/account/export` route provides the GDPR data export, including authored content. Keep access tied to the requesting identity and audit the shape whenever you add user-owned records. Never include provider tokens, signing secrets or another workspace's private data.",
        ],
      },
      {
        id: "verify",
        title: "Verify account transitions",
        paragraphs: [
          "Test current-session sign-out, revoking another session, expiry, reauthentication and export access. Clear the previous account's cached presentation before rendering the next user's workspace.",
        ],
        links: [{ href: "/docs/security/privacy", label: "Privacy and data handling" }],
      },
    ],
  ),
  feature(
    "modules/entitlements",
    "Billing & entitlements",
    "Entitlements & plan gates",
    "Use the workspace entitlement ledger as the single access decision across API actions, content readers, and paid-feature presentation.",
    [
      {
        id: "ledger",
        title: "Use a shared machine key",
        paragraphs: [
          "`ProductPlan.entitlement` in `apps/web/src/product-plans.ts` names the grant written by verified billing events. `EntitlementGate.entitlementKey` and CMS `required_entitlement` compare against the same key. The shipped pro/lifetime example grants `ai.reference-task`.",
        ],
      },
      {
        id: "server",
        title: "Enforce the grant before work",
        paragraphs: [
          "The server checks the active workspace's entitlement before paid work. `EntitlementGate` is presentation and must accompany an authorized server read/action. Check expiry and subscription changes through the shared billing ledger; never derive access from a redirect query parameter.",
        ],
      },
      {
        id: "verify",
        title: "Verify lifecycle and denial",
        paragraphs: [
          "Test active, inactive, expired and cancelled grants, webhook replay, unknown keys and another workspace. Native purchases use the server entitlement view and the RevenueCat seam.",
        ],
        links: [
          { href: "/docs/modules/billing-configuration", label: "Billing configuration" },
          { href: "/docs/modules/content", label: "Gated content" },
          { href: "/docs/mobile/in-app-purchases", label: "Native purchases" },
        ],
      },
    ],
  ),
  feature(
    "modules/product-plans",
    "Billing & entitlements",
    "Plans, intervals & seats",
    "Configure product tiers, provider price mappings, monthly/yearly intervals, and seat quantities without changing the entitlement contract.",
    [
      {
        id: "catalog",
        title: "Configure the plan catalog",
        paragraphs: [
          "`apps/web/src/product-plans.ts` owns product plans and their entitlement keys. Provider product/price IDs are server configuration. The default catalog is an example for the product you build, separate from purchasing this kit.",
          "Review the billing runtime and tests before changing plan IDs, recurrence or lifetime behavior. A display label must not become the durable identifier.",
        ],
      },
      {
        id: "map",
        title: "Map provider prices",
        paragraphs: [
          "The billing adapters support per-seat quantity and monthly/yearly intervals through the common BFF. Use the provider-specific optional `_PRO`, `_PRO_YEARLY` and `_LIFETIME` configuration where supported; all keys are listed in the environment reference. A yearly choice needs the corresponding configured product/price.",
        ],
      },
      {
        id: "verify",
        title: "Verify quantities and intervals",
        paragraphs: [
          "Test allowed quantities, missing yearly mapping, a changed subscription and entitlement expiry. Run lifecycle checks in the selected provider's sandbox before making paid checkout available.",
        ],
        links: [
          { href: "/docs/reference/environment", label: "Environment variables" },
          { href: "/docs/modules/billing-configuration", label: "Signed billing events" },
        ],
      },
    ],
  ),
  feature(
    "modules/workspace-credits",
    "Billing & entitlements",
    "Workspace credits",
    "Give each workspace a prepaid credit balance that metered AI tasks spend automatically when the plan's usage quota runs out.",
    [
      {
        id: "ledger",
        title: "A prepaid pool beside the plan quota",
        paragraphs: [
          "Workspace credits are a consumable balance scoped to one workspace. The schema holds the current amount in `credit_balance` and every change in the append-only `credit_transaction` ledger; `packages/db/src/credits.ts` applies each signed delta and writes the ledger row inside one transaction. The pool sits beside the per-period `usage_counter` quota, not inside it.",
          "Spending is automatic: when a configured `usageLimits` quota rejects an AI request with `quota_exhausted`, the runtime debits that many credits (kind `debit`, reason `usage quota overflow`) instead of failing the task. Unlimited or unconfigured meters never reach the ledger — the shipped plans set no `usageLimits`, so the overflow path stays dormant until a plan configures one.",
        ],
        code: "packages/db/src/credits.ts\napps/web/src/credits.ts\napps/web/src/usage-quota.ts\napps/web/src/ai-task-runtime.ts",
      },
      {
        id: "grants",
        title: "How credits arrive",
        paragraphs: [
          "Plans grant credits through the billing lifecycle: `ProductPlan.creditGrant` in `apps/web/src/product-plans.ts` declares the amount, and `apps/web/src/billing-runtime.ts` grants it when a subscription activates — once per subscription, keyed by a `plan-credit:` reference so webhook replays never double-grant.",
          "Platform admins can also top up a workspace from `/admin/organizations` or `POST /api/admin/credits` (form or JSON). Each grant validates that the workspace exists, records the admin as the actor, and writes an `admin.credits_granted` audit event.",
        ],
      },
      {
        id: "surfaces",
        title: "Where members see the balance",
        paragraphs: [
          "`GET /api/workspace/credits` (web session) and `GET /api/mobile/credits` return the balance plus the newest 50 ledger entries. The `/billing` page renders them in the workspace credits card, and the mobile billing screen shows the same data through `apps/mobile/src/credits/client.ts`.",
          "The ledger is append-only and the balance can never go negative: a debit the pool cannot cover throws `InsufficientCreditsError` and writes nothing, so an empty pool fails the request the same way an exhausted quota does.",
        ],
      },
      {
        id: "verify",
        title: "Verify grants and overflow debits",
        paragraphs: [
          "For a local check, configure a test plan with a small `usageLimits` value for `ai.requests` plus a `creditGrant`, sign in as a platform admin, grant credits to a test workspace, and run AI requests past the quota. The billing card should show `grant` then `debit` entries and a balance that stops at zero — never below.",
        ],
        links: [
          { href: "/docs/modules/billing", label: "Billing lifecycle" },
          { href: "/docs/modules/product-plans", label: "Set your own products and prices" },
          { href: "/docs/modules/admin", label: "Platform roles" },
        ],
      },
    ],
  ),
  feature(
    "modules/usage-controls",
    "Billing & entitlements",
    "Usage controls & budgets",
    "Cap workspace AI spend and per-meter usage, and show members the same read-only usage view on web and mobile.",
    [
      {
        id: "limits",
        title: "Budgets and meter caps",
        paragraphs: [
          "Settings → Usage lets workspace owners and admins set a monthly AI budget in USD and a cap for each registered meter. Caps are hard ceilings: once a meter reaches its cap, requests that would exceed it are refused until the next monthly period. Members can view the same page read-only; only owner/admin roles change the limits.",
          "AI spend draws prepaid workspace credits only above the plan's included allowance — the plan's `usageLimits` in `apps/web/src/product-plans.ts` are consumed first, then overage debits appear on the credit ledger. `USAGE_METERS` in `apps/web/src/usage-meters.ts` is where products register additional meters; each registered meter gets its own cap control automatically.",
        ],
        code: "apps/web/src/usage-meters.ts\napps/web/src/usage-quota.ts\napps/web/src/usage-overview.ts\npackages/db/src/schema.ts (workspace_usage_cap)",
      },
      {
        id: "surfaces",
        title: "Web and mobile surfaces",
        paragraphs: [
          "The web usage page is server-rendered and works without JavaScript; Save, Use default, and Clear are plain form posts. Mobile reads the same overview through `GET /api/mobile/usage` on the billing screen, so a member sees identical counters on both platforms.",
        ],
      },
      {
        id: "verify",
        title: "Verify the boundaries",
        paragraphs: [
          "Set a tiny meter cap as an owner, run requests past it, and confirm the refusal plus a member-role denial on the update action. Confirm a member still sees current usage read-only on web and mobile.",
        ],
        links: [
          { href: "/docs/modules/workspace-credits", label: "Workspace credits" },
          { href: "/docs/security/rate-limiting", label: "Rate limits & public AI budget" },
          { href: "/docs/reference/api-routes", label: "API route reference" },
        ],
      },
    ],
  ),
  feature(
    "modules/chat",
    "AI & agents",
    "Chat & streaming",
    "Use workspace-scoped threads and SSE responses with server model policy, per-attempt budget reservations, and usage recording.",
    [
      {
        id: "threads",
        title: "Keep conversation ownership explicit",
        paragraphs: [
          "The `/chat` surface stores threads/messages behind `/api/chat/threads` and its thread routes. `resolveChatScope` resolves both user and active workspace; mutations request write access. A thread identifier alone never authorizes a read or write.",
          "On Expo, New chat starts a new thread and keeps earlier conversations in the thread list.",
        ],
      },
      {
        id: "stream",
        title: "Follow the stream contract",
        paragraphs: [
          "`POST /api/chat/stream` emits SSE events. The runtime uses allowed aliases, shared AI submission limits, budget reservation before each provider attempt and actual-usage recording. Errors such as no eligible model or an exhausted workspace budget become safe stream messages.",
          "This streaming surface differs from the durable background-task route. Review `chat-stream-runtime.ts`, `chat-budget.ts` and the shipped web/mobile stream clients before changing event framing.",
          "The Expo chat exposes model-alias and structured-output controls and a Stop action. Stop aborts the request signal through the runtime and provider path; aborted calls are not retried. The submitted user prompt is saved before generation; if cancellation is observed before assistant persistence, the reply is neither saved nor rendered, and cancellation emits no SSE error.",
          "The current handler awaits `generateText` before splitting the completed response into SSE chunks, so these are not live provider-token updates. Abort stops provider work where that provider honors the signal; verify this behavior for each production provider you support.",
        ],
      },
      {
        id: "verify",
        title: "Verify incomplete streams",
        paragraphs: [
          "Test a new and existing thread, foreign-workspace IDs, budget denial, interrupted output, provider failure and refresh restoration. Do not report chunked output as proof of a durable job or independently delivered email.",
        ],
        links: [
          { href: "/docs/modules/ai-configuration", label: "Model policy" },
          { href: "/docs/modules/task-recovery", label: "Durable task recovery" },
        ],
      },
    ],
  ),
  feature(
    "modules/byok",
    "AI & agents",
    "Bring your own API key",
    "Store workspace provider keys in the encrypted vault and resolve them only on the server when executing authorized AI work.",
    [
      {
        id: "vault",
        title: "Configure encryption first",
        paragraphs: [
          "`CREDENTIAL_ENCRYPTION_KEY` is a 32-byte base64 encryption key. Generate and keep it in your server secret store; losing or replacing it without a migration makes existing envelopes unreadable. Never put it in a public client environment variable.",
        ],
      },
      {
        id: "store",
        title: "Use the existing credential boundary",
        paragraphs: [
          "The workspace BYOK flow stores encrypted provider envelopes. Server execution resolves platform or workspace credentials; returned UI state must be sanitized. Follow the credential-vault helpers and AI provider composition rather than saving a raw key in product settings.",
          "BYOK changes credential ownership. It does not bypass model capability checks, workspace policy, entitlements, usage recording or budget enforcement.",
        ],
      },
      {
        id: "verify",
        title: "Test credential isolation",
        paragraphs: [
          "Verify save, replace, delete, provider mismatch, decryption failure and another workspace's key. Scan log/error payloads for accidental token material before enabling a provider integration.",
        ],
        links: [
          { href: "/docs/security/secrets", label: "Secrets and redaction" },
          { href: "/docs/modules/ai-configuration", label: "AI policy" },
        ],
      },
    ],
  ),
  feature(
    "modules/model-catalog",
    "AI & agents",
    "Model catalog, routing & budgets",
    "Configure enabled model capabilities and immutable prices, route cheap/fast/smart aliases, and reserve workspace spend before generation.",
    [
      {
        id: "catalog",
        title: "Enter real catalog records",
        paragraphs: [
          "Model IDs and prices come from the database catalog, never a seeded current-prices list. Add an enabled model, its capability set and effective immutable price history through the catalog administration path. Preserve historical prices so past usage remains explainable.",
        ],
      },
      {
        id: "policy",
        title: "Choose ordered aliases",
        paragraphs: [
          "`AI_MODEL_POLICY` supplies ordered IDs for `cheap`, `fast` and `smart`. Empty arrays disable a choice. The router intersects policy, enabled catalog entries, required capabilities and workspace budget; the browser receives permitted aliases rather than choosing raw providers.",
        ],
        code: 'AI_MODEL_POLICY=\'{"cheap":[],"fast":["your-catalog-model-id"],"smart":["your-catalog-model-id"]}\'',
      },
      {
        id: "verify",
        title: "Verify spend accounting",
        paragraphs: [
          "Test no eligible model, unavailable capabilities, an inactive grant, an exhausted budget, provider retry and actual usage. Public AI is separately capped by `PUBLIC_AI_DAILY_BUDGET_MICROUNITS` and is disabled at zero.",
        ],
        links: [
          { href: "/docs/modules/byok", label: "Workspace credentials" },
          { href: "/docs/security/rate-limiting", label: "Rate and public spend limits" },
        ],
      },
    ],
  ),
  feature(
    "modules/workspace-tools",
    "AI & agents",
    "Workspace tools",
    "Define tools once for agent runners and MCP while the server injects identity, workspace ownership, and read/write scopes.",
    [
      {
        id: "define",
        title: "Extend the shared registry",
        paragraphs: [
          "`apps/web/src/workspace-tools.ts` uses `defineTool` from `@supastack/agents`. Each tool has a snake_case name, input schema and read/write scope. It receives `ToolContext` from the authenticated caller; `workspaceId` never belongs in model-selected input.",
        ],
      },
      {
        id: "expose",
        title: "Use the same authorization path",
        paragraphs: [
          "Both agent adapters and `/api/mcp` consume the registry. MCP filters tools by API-key scopes and reuses the public BFF. Adding a tool must not create a route that bypasses the ModelRouter budget or broadens workspace access.",
        ],
      },
      {
        id: "verify",
        title: "Test tool denials",
        paragraphs: [
          "Test valid input, malformed input, absent write scope and attempted access to a foreign record. Agent runners have no public endpoint; product-specific orchestration stays server-side.",
        ],
        links: [
          { href: "/docs/modules/agent-frameworks", label: "Agent adapters" },
          { href: "/docs/modules/mcp-server", label: "MCP transport" },
        ],
      },
    ],
  ),
  feature(
    "modules/schedules",
    "Jobs & email",
    "Recurring schedules",
    "Create workspace job_schedule rows and drive due work through the shared claim-then-advance scheduler, locally or with Trigger.dev cron.",
    [
      {
        id: "rows",
        title: "Store recurring work in the database",
        paragraphs: [
          "Settings scheduling stores the job type and cron rule in workspace-scoped `job_schedule` rows. Cron fields are evaluated in UTC. `createDrizzleJobScheduler.claimDueSchedules` claims due rows using `FOR UPDATE SKIP LOCKED`, advances their next run, then dispatches handlers.",
          "The generic `JobRunner` promises enqueue/status/cancel. Recurrence belongs to scheduler rows; Trigger.dev workflow semantics stay explicit.",
        ],
      },
      {
        id: "tick",
        title: "Drive scheduler ticks",
        paragraphs: [
          "Set a server-only `SCHEDULER_TICK_SECRET` to enable `POST /api/internal/scheduler-tick`. `pnpm jobs:tick` calls it for dev/CI; absent configuration returns 404. Under `JOB_PROVIDER=trigger`, the deployed `scheduler.tick` cron drives the scheduler.",
        ],
        code: "# Against a running local app, with SCHEDULER_TICK_SECRET configured:\ncorepack pnpm jobs:tick",
      },
      {
        id: "verify",
        title: "Verify claims and execution separately",
        paragraphs: [
          "Test overlapping ticks, due/not-due rules, disabled rows, handler failure, cancellation and another workspace's schedule. Inspect claim/advance and job completion separately; a claimed row is not proof of completed work.",
        ],
        links: [
          { href: "/docs/modules/scheduled-digest", label: "Shipped email.digest example" },
          { href: "/docs/modules/jobs", label: "Trigger.dev execution" },
        ],
      },
    ],
  ),
  feature(
    "modules/email-templates",
    "Jobs & email",
    "Email templates & previews",
    "Customize React Email templates, localized copy, and sender branding while keeping transactional delivery separate from outreach.",
    [
      {
        id: "templates",
        title: "Edit the template source",
        paragraphs: [
          "React Email components provide the branded authentication, invite, billing and AI completion messages. Locate templates under `apps/web/src` and follow the shared email service; pass the recipient locale to the existing dictionary-based copy.",
          "Configure `EMAIL_FROM` and verified provider identity separately from visible template branding. Never include provider credentials or full session secrets in message diagnostics.",
        ],
      },
      {
        id: "preview",
        title: "Preview before sending",
        paragraphs: [
          "The dev-only `/mail-preview` route lets you inspect template presentation; it returns 404 in production. Validate subject, plain-text content, links, dark/light rendering and long localized copy. A preview is not delivery acceptance.",
        ],
      },
      {
        id: "verify",
        title: "Verify delivery independently",
        paragraphs: [
          "Use the local adapter for deterministic tests and a separately configured test recipient for real-provider acceptance. Inspect email failure state without regenerating an already saved AI result. Transactional and outreach paths remain separate.",
        ],
        links: [
          { href: "/docs/modules/email", label: "Transactional email" },
          { href: "/docs/web/i18n", label: "Localized copy" },
        ],
      },
    ],
  ),
  feature(
    "modules/storage",
    "Database & storage",
    "Storage",
    "Configure in-memory or S3-compatible object storage for files and avatars, with workspace authorization and server-only credentials.",
    [
      {
        id: "provider",
        title: "Select the storage backend",
        paragraphs: [
          "`STORAGE_PROVIDER=memory` is the credential-free default. `s3` uses `apps/web/src/storage-runtime.ts` to compose the AWS SDK client over the narrow `@supastack/storage` contract. Custom endpoints support Supabase Storage and MinIO, with path-style URLs enabled by default.",
        ],
        code: "STORAGE_PROVIDER=s3\nSTORAGE_REGION=us-east-1\nSTORAGE_BUCKET=your-product-bucket\n# Set STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY on the server.\n# Optional: STORAGE_ENDPOINT, STORAGE_FORCE_PATH_STYLE, STORAGE_PUBLIC_BASE_URL",
      },
      {
        id: "uploads",
        title: "Reuse the upload boundaries",
        paragraphs: [
          "The shipped routes cover objects, avatars, profile logos and organization logos under `/api/storage/`. They resolve identity/workspace permissions and validate upload shape before storage. Inspect the chosen route's size/type policy rather than accepting arbitrary client object keys.",
          "Public URLs are presentation, not authorization. Keep protected content behind the application's verified read boundary and configure bucket/CDN policy for your product's data.",
        ],
      },
      {
        id: "verify",
        title: "Test real storage behavior",
        paragraphs: [
          "Test allowed/denied uploads, MIME and size rejection, foreign-workspace paths, missing objects and provider failure. Memory mode does not persist across processes; verify storage and retrieval against the selected backend before release.",
        ],
        links: [
          { href: "/docs/deploy/supabase-cloud", label: "Supabase Storage setup" },
          { href: "/docs/reference/api-routes", label: "Upload route inventory" },
        ],
      },
    ],
  ),
  feature(
    "modules/content",
    "Database & storage",
    "CMS & gated content",
    "Manage workspace-scoped posts, pages, docs and reports with publishing states, unique slugs, and optional plan-based reading access.",
    [
      {
        id: "entries",
        title: "Create workspace entries",
        paragraphs: [
          "The `/content` manager handles `post`, `page`, `doc` and `report` entries. `content_entry` rows have draft/published/archived state, workspace-scoped slugs and authorship. Management actions require the appropriate owner/admin role.",
          "This CMS is separate from the kit's typed public docs/blog catalog in `src/resources`. A product can render CMS entries through its own page composition.",
        ],
      },
      {
        id: "access",
        title: "Gate the body on the server",
        paragraphs: [
          "`required_entitlement` is nullable: unset entries are ungated. For gated entries, server-only `content-queries.ts` projects readable content or a locked teaser with an empty body. `content-access.ts` owns the projection; never trust a client-supplied entitlement claim.",
          "Publishing emits `content.published`; scheduled digests can summarize the publishing team's recent entries. Authored content also participates in account export.",
        ],
      },
      {
        id: "verify",
        title: "Verify publishing and access",
        paragraphs: [
          "Test draft visibility, publish/archive transitions, duplicate slugs, wrong workspace, free entries and inactive paid grants. Use the paywall block for presentation while the server remains responsible for access.",
        ],
        links: [
          { href: "/docs/tutorials/paid-content", label: "Paid-content tutorial" },
          { href: "/docs/modules/scheduled-digest", label: "Content digests" },
          { href: "/docs/components/paywall-gate", label: "Paywall presentation" },
        ],
      },
    ],
  ),
  feature(
    "modules/commerce",
    "Database & storage",
    "Workspace commerce",
    "Manage products, inventory and order lifecycles with workspace roles, server-calculated totals, and stable historical order items.",
    [
      {
        id: "products",
        title: "Manage products and inventory",
        paragraphs: [
          "`/commerce` provides owner/admin management for workspace products. Product states are draft/active/archived; prices use minor currency units and inventory is optionally tracked. Shared persistence lives in `packages/db`.",
          "This is a product-building module. It does not include purchasing this kit, source-repository delivery or license fulfillment.",
        ],
      },
      {
        id: "orders",
        title: "Follow the order lifecycle",
        paragraphs: [
          "Orders advance pending → paid → fulfilled, with cancellation/restocking and refund behavior. The server computes totals and stores item product-name/unit-price snapshots so edits to a product do not rewrite historical orders. `commerce.order_*` events support downstream integrations.",
          "Connect a real product payment flow deliberately. An admin state transition alone does not verify a payment provider charge or refund.",
        ],
      },
      {
        id: "verify",
        title: "Test stock and state transitions",
        paragraphs: [
          "Verify insufficient inventory, concurrent orders, client-price tampering, invalid backward transitions, cancellation restocking, refund behavior and cross-workspace access.",
        ],
        links: [
          { href: "/docs/modules/webhooks", label: "Outbound commerce events" },
          { href: "/docs/components/product-grid", label: "Product grid block" },
          { href: "/docs/components/data-table", label: "Records table block" },
        ],
      },
    ],
  ),
  feature(
    "modules/notifications",
    "Workspace features",
    "Notifications & preferences",
    "Deliver workspace product events to eligible members and honor their in-app and email preferences through the existing event pipeline.",
    [
      {
        id: "events",
        title: "Use the product event pipeline",
        paragraphs: [
          "`notification-events.ts` maps billing, budget, invite, membership and connected-account events to localized copy and per-member delivery plans. The API and app clients read the signed-in workspace's notifications; preferences control eligible channels.",
          "Some events intentionally stay in-app. Connected-account refresh failures, for example, must not expose token detail or trigger unsolicited email.",
        ],
      },
      {
        id: "delivery",
        title: "Respect recipient preferences",
        paragraphs: [
          "Use the existing delivery planner, default preferences and actor-exclusion options rather than independently sending a message to every member. Transactional email still uses the configured provider and records its own delivery outcome.",
        ],
      },
      {
        id: "verify",
        title: "Verify recipients and state",
        paragraphs: [
          "Test a disabled preference, excluded actor, removed member, unread/read behavior and another workspace. Keep dynamic updates accessible and verify localized messages.",
        ],
        links: [
          { href: "/docs/modules/email", label: "Email delivery" },
          { href: "/docs/web/i18n", label: "Notification dictionaries" },
        ],
      },
    ],
  ),
  feature(
    "modules/push-notifications",
    "Workspace features",
    "Push notifications",
    "Deliver workspace notifications to members' devices through the Expo push service, with token registration, best-effort fan-out, and graceful degradation.",
    [
      {
        id: "register",
        title: "Register devices on sign-in",
        paragraphs: [
          "The mobile app asks for notification permission, fetches an Expo push token, and registers it through `POST /api/mobile/push-tokens` once the session has an active workspace. `packages/db/src/push-tokens.ts` upserts by token into the `device_push_token` table, so reinstalls and device moves re-point the same row at the signing-in user.",
          "`MobileAppProvider` registers after sign-in and unregisters on sign-out while the cookie is still valid. Settings → Notifications shows the device push state with a toggle, and `DELETE` on the same endpoint revokes a token.",
        ],
        code: "apps/mobile/src/push/register.ts\napps/mobile/src/push/expo.ts\napps/mobile/src/push/client.ts\napps/web/app/api/mobile/push-tokens/route.ts\npackages/db/src/push-tokens.ts",
      },
      {
        id: "send",
        title: "Send with the notification pipeline",
        paragraphs: [
          "`apps/web/src/push.ts` posts messages to the Expo push API in chunks of at most 100. Only `ExponentPushToken[...]` values reach the network — anything else is skipped outside local/test `APP_ENV` — and tickets that report `DeviceNotRegistered` prune the stale rows automatically.",
          "`notification-runtime.ts` wires `sendUserPush` into `notification-emit.ts`, so every workspace notification that emits in-app also pushes to the recipient's registered devices as a best-effort step — a push failure never blocks the in-app record.",
        ],
      },
      {
        id: "limits",
        title: "Know the delivery boundaries",
        paragraphs: [
          "Expo Go and simulators cannot complete registration or delivery — use a physical device or an EAS development build. A denied permission, missing Expo project id, or offline failure resolves to a state instead of throwing, so sign-in never blocks on push and the app degrades gracefully.",
        ],
      },
      {
        id: "verify",
        title: "Verify on a real device",
        paragraphs: [
          "Run the Web backend and the mobile app, sign in on a real device, grant the permission, and confirm a token registers. Trigger a workspace event such as an invite and expect the notification on the device and in the app; toggling the setting off revokes the token.",
        ],
        links: [
          { href: "/docs/modules/notifications", label: "Workspace notifications" },
          { href: "/docs/mobile/local-setup", label: "Mobile local setup" },
          { href: "/docs/mobile/builds", label: "Create a native development build" },
        ],
      },
    ],
  ),
  feature(
    "modules/connected-accounts",
    "Workspace features",
    "Connected accounts",
    "Connect X, Google and Microsoft accounts to a workspace with PKCE, state validation, encrypted token storage, and refresh recovery.",
    [
      {
        id: "apps",
        title: "Configure external-account apps",
        paragraphs: [
          "Settings → Connections uses separate OAuth app credentials from sign-in. Configure `CONNECTED_X_*`, `CONNECTED_GOOGLE_*` or `CONNECTED_MICROSOFT_*`. An empty client ID disables the flow; Google/Microsoft also require their confidential-client secret. X can use a public PKCE client.",
        ],
        code: "Callback URLs:\n{APP_URL}/api/accounts/x/callback\n{APP_URL}/api/accounts/google/callback\n{APP_URL}/api/accounts/microsoft/callback",
      },
      {
        id: "vault",
        title: "Keep credentials in the vault",
        paragraphs: [
          "`connected-account-service.ts` checks membership, creates PKCE/state, validates callbacks and stores AES-256-GCM token envelopes. The runtime binds persistence, vault, audit and notification services; the model/client never receives token material.",
          "A refresh failure such as `invalid_grant` moves the connection to `needs_reauth`. Present the reconnect action using sanitized failure categories.",
        ],
      },
      {
        id: "verify",
        title: "Test callback and refresh failures",
        paragraphs: [
          "Verify state mismatch, cancelled consent, wrong-workspace writes, refresh-token replacement, reconnect and disconnect. Register callbacks matching the actual deployed origin.",
        ],
        links: [
          { href: "/docs/modules/byok", label: "Encryption configuration" },
          { href: "/docs/security/secrets", label: "Secret handling" },
        ],
      },
    ],
  ),
  feature(
    "modules/webhooks",
    "Workspace features",
    "Outbound webhooks",
    "Send signed workspace product events to customer endpoints with scoped management, delivery records, retries, and terminal-failure alerts.",
    [
      {
        id: "endpoints",
        title: "Create an endpoint",
        paragraphs: [
          "Settings → Developers manages workspace webhook endpoints and subscriptions. `webhooks.ts`, `webhooks-actions.ts` and `webhook-events.ts` own validation, management and event envelopes. Webhook signing secrets are revealed through the existing creation flow and remain server-only afterwards.",
          "Outbound product webhooks differ from inbound billing webhooks: billing verifies a provider's signature; this feature signs your workspace event for a customer receiver.",
        ],
      },
      {
        id: "delivery",
        title: "Inspect delivery records",
        paragraphs: [
          "`webhook-delivery.ts` handles dispatch and persists delivery outcomes. Verify signature headers against the shipped sender implementation, acknowledge quickly in your receiver and deduplicate event IDs. Use the endpoint's ping/delivery history to diagnose its response.",
          "Terminal failures emit `webhook.delivery_failed` and can trigger a critical alert through `ALERT_WEBHOOK_URL`. Correlation IDs tie dispatch and diagnostics together.",
        ],
      },
      {
        id: "verify",
        title: "Test receivers and retries",
        paragraphs: [
          "Test signature rejection, endpoint failure, duplicate delivery, scope denial and foreign endpoint IDs. Restrict endpoints according to the existing validation policy rather than turning this into arbitrary server-side URL fetching.",
        ],
        links: [
          { href: "/docs/modules/observability", label: "Delivery alerts and correlation" },
          { href: "/docs/modules/billing-configuration", label: "Inbound billing webhooks" },
        ],
      },
    ],
  ),
  feature(
    "modules/feedback",
    "Workspace features",
    "Feature requests & voting",
    "Use the workspace feedback board for member requests, one-vote-per-member tracking, management statuses, and product event notifications.",
    [
      {
        id: "board",
        title: "Use the shipped board",
        paragraphs: [
          "`/feedback` lets workspace members create requests and vote. `feature_request` and `feature_request_vote` persist workspace ownership. The vote table's composite key enforces one vote per request/member; the denormalized count changes in the same transaction.",
        ],
      },
      {
        id: "status",
        title: "Manage request status",
        paragraphs: [
          "Management can move a request through open, under_review, planned, in_progress, shipped and closed. Status changes and new requests emit `feature_request.*` audit/webhook events. Member input cannot choose the owning workspace.",
        ],
      },
      {
        id: "verify",
        title: "Verify vote consistency",
        paragraphs: [
          "Test repeated/concurrent votes, vote removal, invalid status, role denial and another workspace's request. A public roadmap is a product-specific presentation over the authorized data, not an automatic export of all feedback.",
        ],
        links: [{ href: "/docs/modules/webhooks", label: "Feature-request events" }],
      },
    ],
  ),
  feature(
    "modules/appearance-sync",
    "Workspace features",
    "Appearance sync",
    "Persist the signed-in user's full theme setup and share it between the web app and the Expo mobile client.",
    [
      {
        id: "bundle",
        title: "One synced appearance bundle",
        paragraphs: [
          "The `user_appearance` table stores the signed-in user's complete appearance bundle: color pack, density, radius, font, layout, toast style, and design style. Web reads and writes it through `GET`/`PUT /api/account/appearance`; the Expo client uses `GET`/`PUT /api/mobile/appearance`. Every write carries the client's `updatedAt` timestamp and the newest bundle wins, so two open devices resolve conflicts deterministically.",
        ],
        code: "packages/db/src/schema.ts (user_appearance)\napps/web/src/appearance-sync.ts\napps/mobile/src/theme/synced.ts",
      },
      {
        id: "boot",
        title: "Boot paint stays local",
        paragraphs: [
          "localStorage and cookies still paint the first frame — sync never delays rendering. The web boot script applies the saved choice instantly and reconciles with the server bundle afterwards. On mobile, the “Match web app” mode applies the synced palette from a local cache, so screens paint correctly even without a connection.",
        ],
      },
      {
        id: "verify",
        title: "Verify across devices",
        paragraphs: [
          "Change the pack in web Settings → Appearance, confirm the saved bundle appears through `GET /api/mobile/appearance`, and check that a write with an older `updatedAt` does not overwrite the newer one.",
        ],
        links: [
          { href: "/docs/web/theming", label: "Product theme" },
          { href: "/docs/web/layouts", label: "App layouts & appearance axes" },
          { href: "/docs/reference/api-routes", label: "API route reference" },
        ],
      },
    ],
  ),
  feature(
    "modules/admin",
    "Admin & growth",
    "Platform admin",
    "Configure bootstrap admins and use the platform administration routes for users, organizations, orders, flags, announcements, and access review.",
    [
      {
        id: "bootstrap",
        title: "Create the admin boundary",
        paragraphs: [
          "`ADMIN_EMAILS` is a server-only comma-separated bootstrap list. Listed users receive the platform admin role on signup. Without it, grant access through an authorized database/admin path; do not make the first arbitrary visitor an admin.",
          "Platform admin is distinct from workspace owner/admin. `/admin` and its user, organization, flag, announcement and waitlist pages check the platform role.",
        ],
      },
      {
        id: "manage",
        title: "Use the implemented controls",
        paragraphs: [
          "The default Better Auth engine provides admin user management, bans and impersonation. The app composes platform views with audit trails. Restrict impersonation to verified admin access, make its state visible and restore the original admin session on exit.",
          "Auth.js does not automatically inherit Better Auth admin plugins. Review `admin.ts`, `admin-actions.ts` and auth-provider behavior before switching engines.",
        ],
      },
      {
        id: "verify",
        title: "Verify privileged actions",
        paragraphs: [
          "Test non-admin denial, admin access, banned-user sessions, impersonation start/stop and the actions you enable. Keep all admin routes outside public indexing.",
        ],
        links: [
          { href: "/docs/modules/feature-flags", label: "Feature flags" },
          { href: "/docs/modules/announcements", label: "Announcements" },
          { href: "/docs/modules/waitlist", label: "Waitlist administration" },
        ],
      },
    ],
  ),
  feature(
    "modules/feature-flags",
    "Admin & growth",
    "Feature flags",
    "Manage platform feature configuration through the admin boundary and resolve flags consistently in server and product presentation.",
    [
      {
        id: "manage",
        title: "Configure flags in Admin",
        paragraphs: [
          "`/admin/flags` and `feature-flags.ts` provide the kit's flag management/evaluation path. Flag configuration belongs to the platform admin; a product UI can react to an allowed feature without gaining authority to change the flag.",
        ],
      },
      {
        id: "authorize",
        title: "Keep authorization separate",
        paragraphs: [
          "A flag enables product behavior, while roles and entitlements authorize a caller. Check both where required. A disabled navigation link does not prevent a direct API call.",
        ],
      },
      {
        id: "verify",
        title: "Verify enabled and disabled behavior",
        paragraphs: [
          "Test defaults, missing flags, updates, role denial and flag-gated server actions. Preserve workspace access checks when adding rollout logic.",
        ],
        links: [
          { href: "/docs/modules/admin", label: "Platform roles" },
          { href: "/docs/modules/entitlements", label: "Paid access" },
        ],
      },
    ],
  ),
  feature(
    "modules/announcements",
    "Admin & growth",
    "Announcements",
    "Publish platform announcements through the admin flow and read them in the application without exposing editing privileges to ordinary members.",
    [
      {
        id: "publish",
        title: "Manage announcement content",
        paragraphs: [
          "`/admin/announcements` owns platform publishing; `/api/announcements` serves the app's announcement surface. Follow the existing admin actions and persistence shape when adding scheduling or targeting.",
        ],
      },
      {
        id: "display",
        title: "Present announcements accessibly",
        paragraphs: [
          "Keep announcement reading distinct from workspace notification delivery. Use a heading and actual link/action, preserve readable content without animation and avoid repeated urgent live announcements for routine updates.",
        ],
      },
      {
        id: "verify",
        title: "Verify visibility and editing",
        paragraphs: [
          "Test ordinary-member reads, platform-admin edits, published/hidden states and long localized text. Do not allow a workspace role to become platform publishing access.",
        ],
        links: [
          { href: "/docs/modules/notifications", label: "Workspace notifications" },
          { href: "/docs/modules/admin", label: "Admin permissions" },
        ],
      },
    ],
  ),
  feature(
    "modules/waitlist",
    "Admin & growth",
    "Waitlist & early access",
    "Capture normalized waitlist emails, issue optional bound invite codes, and gate new account creation through the early-access setting.",
    [
      {
        id: "capture",
        title: "Use the waitlist form",
        paragraphs: [
          "The marketing waitlist stores platform-level `waitlist_entry` rows, moving waiting → invited → joined. Email normalization, referral-code generation and status messages live in `src/growth/waitlist.ts`; these marketing assets intentionally have no workspace yet.",
        ],
      },
      {
        id: "gate",
        title: "Enable invite-only signup",
        paragraphs: [
          "`EARLY_ACCESS_INVITE_ONLY=true` requires a valid code for new accounts. `/admin/waitlist` issues codes, optionally bound to an email and expiry. Existing sessions, configured admin bootstrap and admin-created users remain unaffected.",
        ],
        code: "EARLY_ACCESS_INVITE_ONLY=true\n# Configure bootstrap ADMIN_EMAILS on the server before enabling the gate.",
      },
      {
        id: "verify",
        title: "Verify invitation states",
        paragraphs: [
          "Test valid, expired, redeemed and wrong-email codes, repeated signup and removed invite cookies. Never reuse an early-access code as a workspace membership invitation.",
        ],
        links: [
          { href: "/docs/modules/referrals", label: "Referral attribution" },
          { href: "/docs/web/organizations", label: "Workspace invitations" },
        ],
      },
    ],
  ),
  feature(
    "modules/referrals",
    "Admin & growth",
    "Referral attribution",
    "Attribute waitlist and signup referrals with sanitized share codes, idempotent records, and self-referral rejection.",
    [
      {
        id: "share",
        title: "Use the generated share URL",
        paragraphs: [
          "Waitlist capture produces a referral code and `/?ref=CODE` share URL. Growth helpers sanitize referral/invite parameters before cookies or queries; only the accepted short identifier shape reaches persistence.",
        ],
      },
      {
        id: "attribute",
        title: "Persist attribution once",
        paragraphs: [
          "The `referral` table records waitlist/signup attribution with uniqueness constraints and append-only behavior. Counts update with deduplicated writes; self-referrals are rejected. This is attribution, not an affiliate payout or billing feature.",
        ],
      },
      {
        id: "verify",
        title: "Test repeat and invalid referrals",
        paragraphs: [
          "Verify invalid codes, self-referrals, repeated email/signup callbacks and concurrent writes. Do not publish private email addresses in referral status or share URLs.",
        ],
        links: [{ href: "/docs/modules/waitlist", label: "Waitlist lifecycle" }],
      },
    ],
  ),
  feature(
    "modules/marketing-forms",
    "Admin & growth",
    "Contact & newsletter forms",
    "Configure inbox notifications and optional local/Firestore lead storage for public forms, with validation, abuse limits, and Turnstile support.",
    [
      {
        id: "configure",
        title: "Configure a lead destination",
        paragraphs: [
          "`MARKETING_INBOX` receives transactional lead notifications. `MARKETING_LEAD_STORE` can also persist leads to local JSON in development or Firestore. Set the Firebase Admin credentials only on the server for Firestore; review `marketing/marketing-leads.ts` and `leads-actions.ts`.",
        ],
        code: "MARKETING_INBOX=team@example.com\n# Development persistence:\nMARKETING_LEAD_STORE=local\n# Production option: firestore + server-only FIREBASE_* credentials.",
      },
      {
        id: "protect",
        title: "Validate and protect submissions",
        paragraphs: [
          "The shipped forms normalize email, reject invalid input, use rate limits and return actionable statuses. `CAPTCHA_PROVIDER=turnstile` protects the contact/newsletter forms when configured. Preserve those server checks when copying a newsletter or CTA block.",
        ],
      },
      {
        id: "verify",
        title: "Test capture and recovery",
        paragraphs: [
          "Test valid/invalid input, missing destination, failed delivery/storage, bot rejection and rate-limit retry. Capturing a newsletter address does not implement a bulk outreach campaign; keep transactional delivery separate.",
        ],
        links: [
          { href: "/docs/security/turnstile", label: "Turnstile configuration" },
          { href: "/docs/modules/email", label: "Email boundary" },
        ],
      },
    ],
  ),
  feature(
    "modules/site-analytics",
    "Admin & growth",
    "Site analytics",
    "Measure public-site traffic behind visitor consent — first-party collection into your own database or a hosted analytics provider.",
    [
      {
        id: "provider",
        title: "Choose the provider",
        paragraphs: [
          "`ANALYTICS_PROVIDER` selects the marketing analytics adapter: `off` (default), `local`, `plausible`, or `posthog`. The script providers require `ANALYTICS_SITE_ID` — the Plausible data-domain or PostHog project key — and accept an optional https `ANALYTICS_HOST` override for self-hosted or EU instances. `off` mounts nothing at all.",
        ],
        code: "ANALYTICS_PROVIDER=local\nANALYTICS_SITE_ID=\nANALYTICS_HOST=",
      },
      {
        id: "consent",
        title: "Consent gates collection",
        paragraphs: [
          "Nothing captures until the visitor accepts: the consent choice drives the banner, the `AnalyticsBeacon`, and the `AnalyticsScriptClient`, all mounted through `MarketingAnalytics`. The beacon posts pageviews and `trackEvent(name)` custom events to `POST /api/analytics/collect`; the script providers inject their vendor tag only after consent. Withdrawing consent disarms the local beacon immediately.",
          "Under `local`, the bounded rate-limited collect endpoint writes `analytics_event` rows through `packages/db/src/analytics-events.ts`. Visitor identity is a daily-rotating salted `visitor_hash` — raw IP and user-agent are never stored — and marketing rows carry no `workspaceId`. The endpoint 404s under other providers so the active mode is never revealed.",
        ],
        code: "apps/web/src/analytics.ts\napps/web/src/marketing/analytics-beacon.tsx\napps/web/src/marketing/analytics-script-client.tsx\napps/web/app/api/analytics/collect/route.ts\npackages/db/src/analytics-events.ts",
      },
      {
        id: "summary",
        title: "Read the admin summary",
        paragraphs: [
          "Under the `local` provider, `/admin` shows platform admins a Site analytics card for the last 30 days: pageviews, distinct visitors, custom events, and top paths. `trackEvent(name)` forwards to the vendor global under a script provider, so product instrumentation survives a provider switch.",
        ],
      },
      {
        id: "verify",
        title: "Verify consent-first capture",
        paragraphs: [
          "With `ANALYTICS_PROVIDER=local` and a migrated database, open the public site in a private window: no collect request fires before consent, each navigation posts a pageview after accepting, and the admin card counts them. Check your product's privacy policy covers what you actually collect before enabling a provider.",
        ],
        links: [
          { href: "/docs/security/privacy", label: "Privacy and data handling" },
          { href: "/docs/security/rate-limiting", label: "Rate and public spend limits" },
          { href: "/docs/reference/environment", label: "Environment variables" },
        ],
      },
    ],
  ),
  feature(
    "web/branding",
    "Customization",
    "Branding & public-site chrome",
    "Rename the product, configure marketing behavior, replace shared logo and social assets, and keep public metadata and legal pages consistent.",
    [
      {
        id: "config",
        title: "Update the site configuration",
        paragraphs: [
          "`apps/web/src/marketing/site-config.ts` owns brand copy, navigation/footer links, FAQ and optional repository/docs destinations. Update this before scattering product names across components. The kit's own chrome uses this config; the copyable chrome blocks accept product props.",
        ],
      },
      {
        id: "assets",
        title: "Replace the asset family together",
        paragraphs: [
          "The demo ships no logo artwork. Add your own web favicon, app icons, and desktop icons when customizing a product. Native packaging uses blank icon placeholders until you supply those assets.",
          "The shared public social card is `/demo-social.png`; update its descriptor in `marketing/seo.tsx` with the dimensions and alt text. Blog article cards use their separate Next image route.",
        ],
      },
      {
        id: "verify",
        title: "Check every public surface",
        paragraphs: [
          "Verify header/footer, contact, FAQ, legal pages, localized home copy, titles and social cards. Choose your product's marketing theme mode and only ship support/contact links that work.",
        ],
        links: [
          { href: "/docs/web/theming", label: "Product styles" },
          { href: "/docs/web/legal-pages", label: "Legal page scaffold" },
          { href: "/docs/web/seo-public-pages", label: "Metadata and social cards" },
        ],
      },
    ],
    "web",
  ),
  feature(
    "web/layouts",
    "Customization",
    "App layouts & appearance axes",
    "Configure sidebar, topnav or focused chrome and combine density, radius, font and toast axes with the shipped style and color catalogs.",
    [
      {
        id: "axes",
        title: "Choose an intentional combination",
        paragraphs: [
          "Settings → Appearance previews complete looks from `STYLE_CATALOG` and individual axes. The root HTML attributes control `data-theme`, `data-density`, `data-radius`, `data-font`, `data-layout` and `data-toast-style`. A custom blend after a named style is an unlabeled mix.",
        ],
      },
      {
        id: "layouts",
        title: "Reframe the app shell",
        paragraphs: [
          "`sidebar`, `topnav` and `focused` styles change `.app-frame` and `.workspace-rail` through `app-theme.css`. They do not fork product route markup. Add a shell by extending `LAYOUT_CATALOG` and matching CSS selectors.",
          "Color packs may paint subtree `[data-theme]` wrappers. Density/radius/font selectors affect app chrome; marketing follow/pin behavior is selected explicitly in `marketing-theme.ts`.",
        ],
      },
      {
        id: "verify",
        title: "Keep previews and content usable",
        paragraphs: [
          "Test every new pack's contrast, the appearance preview, `/kit-blocks`, keyboard focus and narrow screens. Page composition remains a product decision; the appearance axes must not force a single hero/nav pattern.",
        ],
        links: [
          { href: "/docs/web/theming", label: "Styles and token catalog" },
          { href: "/docs/web/kit-blocks", label: "Copyable blocks" },
        ],
      },
    ],
    "web",
  ),
  feature(
    "web/agent-prompts",
    "Customization",
    "Agent prompts & project memory",
    "Use the shipped prompts for style selection, landing pages, app screens, restyling, and UI audits while preserving the repository's agent boundaries.",
    [
      {
        id: "prompts",
        title: "Choose a task prompt",
        paragraphs: [
          "The `prompts/` library includes `pick-a-style.md`, `new-landing-page.md`, `new-app-screen.md`, `restyle-product.md` and `ui-audit.md`. Start with the prompt matching the outcome, add your product context and supply the route/feature you want changed.",
        ],
      },
      {
        id: "memory",
        title: "Keep the agent context current",
        paragraphs: [
          "Read `AGENTS.md` and `.ai/PROJECT_CONTEXT.md` before code changes. Matching `.ai/` file docs preserve source-specific constraints and reasoning. User-owned data is workspace-scoped, provider secrets stay server-only, and the buyer kit contains no license-fulfillment machinery.",
        ],
      },
      {
        id: "verify",
        title: "Review the concrete result",
        paragraphs: [
          "Ask the agent to trace the shipped contract, write behavior tests first, update matching mirrors, and verify the target screen on desktop/mobile. Keep publishing, paid calls and production changes as separately authorized actions.",
        ],
        links: [
          { href: "/docs/web/kit-blocks", label: "Block-first composition" },
          { href: "/docs/web/testing", label: "Verification gates" },
        ],
      },
    ],
    "web",
  ),
  feature(
    "web/legal-pages",
    "Customization",
    "Legal & policy pages",
    "Adapt the privacy, terms, acceptable-use, disclaimer and license scaffolds to your product, preserving readable structure and public route metadata.",
    [
      {
        id: "content",
        title: "Edit the policy source",
        paragraphs: [
          "`marketing/legal-content.ts` defines the shipped documents and `legal-page.tsx` renders their sections and lists. Public routes include `/privacy`, `/terms`, `/legal/acceptable-use`, `/legal/disclaimer` and `/legal/license`. Review them against your product's actual data handling, contracts and operating context.",
        ],
      },
      {
        id: "links",
        title: "Keep links and indexing consistent",
        paragraphs: [
          "Update the site footer, route metadata/canonical and sitemap together when adding or renaming a policy. The copyable `prose-page` block supports product-specific long-form pages without importing the kit's branded chrome.",
        ],
      },
      {
        id: "verify",
        title: "Check the published content",
        paragraphs: [
          "Verify headings, lists, dates/contact details, mobile reflow and footer links. The scaffold requires your product's content review; implementation tests do not establish legal suitability.",
        ],
        links: [
          { href: "/docs/components/prose-page", label: "Prose page block" },
          { href: "/docs/web/seo-public-pages", label: "Public route checklist" },
        ],
      },
    ],
    "web",
  ),
  feature(
    "marketing/public-pages",
    "Customization",
    "Public changelog, roadmap & API reference",
    "Ship three indexable public pages — a shipped-capability changelog, a curated roadmap, and a readable API reference rendered from the OpenAPI document.",
    [
      {
        id: "pages",
        title: "Three public surfaces",
        paragraphs: [
          "`/changelog` lists shipped capabilities from `src/marketing/changelog-entries.ts`, `/roadmap` groups curated plans by status from `src/marketing/roadmap-items.ts`, and `/api-reference` renders the endpoint list — method badge, path, summary, and access label — grouped by tag straight from the served OpenAPI document, so it cannot drift from the registered routes.",
          "Each page ships an unprefixed English route plus a `/[locale]/` mirror; `/en` redirects to the unprefixed path. `/api-reference` complements the interactive Scalar console at `/api/docs`, and all three are linked from the footer Resources group and listed in `llms.txt`.",
        ],
        code: "apps/web/app/changelog/page.tsx\napps/web/app/roadmap/page.tsx\napps/web/app/api-reference/page.tsx\napps/web/src/marketing/changelog-entries.ts\napps/web/src/marketing/roadmap-items.ts\napps/web/src/marketing/api-reference.ts",
      },
      {
        id: "edit",
        title: "Add a changelog or roadmap entry",
        paragraphs: [
          "Prepend to `changelog-entries.ts` newest-first: a unique ISO `date`, a release headline `title`, and `points` bullets — one shipped capability each, written as buyer-verifiable outcomes rather than implementation internals. `roadmap-items.ts` takes `title`, `description`, and a `planned` | `in_progress` | `shipped` status; the page links visitors to `/feedback` instead of reading the private feature-request board.",
          "Both lists are static curated data for the boilerplate demo — a product building on the kit replaces them with its own release notes and plans.",
        ],
      },
      {
        id: "seo",
        title: "Indexing stays wired",
        paragraphs: [
          "All three routes appear in `marketingStaticPaths` with `STATIC_ENTRY_META` sitemap hints, carry canonical plus `pageLanguageAlternates` hreflang metadata and `BreadcrumbList` JSON-LD, and stay `force-dynamic`. When you add another public page, update the same sources — the sitemap, `STATIC_PAGE_INFO` for `llms.txt`, and `siteConfig.resourceLinks` — instead of hardcoding entries.",
        ],
        links: [
          { href: "/changelog", label: "Open the changelog" },
          { href: "/roadmap", label: "Open the roadmap" },
          { href: "/api-reference", label: "Open the API reference" },
          { href: "/docs/web/seo-public-pages", label: "Public route checklist" },
        ],
      },
    ],
    "web",
  ),
  feature(
    "desktop",
    "Desktop",
    "Desktop overview",
    "Understand the Tauri shell over the hosted web application, including native menus, tray, hotkey, deep links, window state, and offline behavior.",
    [
      {
        id: "architecture",
        title: "One product UI, a native shell",
        paragraphs: [
          "`apps/desktop` is a Tauri webview over your web app. It shares product UI, authentication and chat with web; native window/tray behavior lives in `src-tauri/src/lib.rs`. It needs a reachable web backend and does not bundle an independent product interface.",
        ],
      },
      {
        id: "behavior",
        title: "Use the native shell features",
        paragraphs: [
          "The shell ships a tray menu, close-to-tray, single-instance focus, global summon hotkey, a native app menu (Check for Updates, Launch at Login), navigation/view menus, external links in the system browser, `supastack://` deep-link summon, remembered window state and an offline Retry overlay. Update checks stay inert until a build injects an update endpoint and signing key.",
          "`SUPASTACK_APP_URL` chooses the backend: valid runtime value, then compile-time value, then localhost. `SUPASTACK_DESKTOP_HOTKEY` overrides `CmdOrCtrl+Shift+Space`.",
        ],
      },
      {
        id: "next",
        title: "Choose your desktop path",
        paragraphs: [
          "Run web and desktop together for local work, then build and verify the native target with its platform prerequisites. Store signing, installers and physical desktop behavior require separate acceptance.",
        ],
        links: [
          { href: "/docs/desktop/local-setup", label: "Set up Tauri desktop in 5 minutes" },
          { href: "/docs/desktop/native-behavior", label: "Window, tray and hotkey behavior" },
          { href: "/docs/desktop/distribution", label: "Desktop builds and distribution" },
        ],
      },
    ],
    "desktop",
  ),
  feature(
    "desktop/local-setup",
    "Desktop",
    "Set up Tauri desktop in 5 minutes",
    "Launch the Tauri desktop shell against the local Next.js app in about five minutes once the Rust and workspace prerequisites are ready.",
    [
      {
        id: "requirements",
        title: "Prepare your native toolchain",
        paragraphs: [
          "This first-run path takes about five minutes after Node.js 22 or newer, Corepack with the repository's pnpm version, workspace dependencies, Rust, and your operating system's Tauri prerequisites are installed. Windows needs native build tools and WebView2; macOS and Linux need their host libraries. The normal `pnpm dev` excludes desktop.",
          "The Tauri shell loads the same Next.js app used by web; it does not bundle a separate product UI or backend. The default local URL is `http://localhost:3000`. Set `SUPASTACK_APP_URL` only when you want to load a different reachable HTTP(S) app origin.",
        ],
      },
      {
        id: "run",
        title: "Start web and Tauri together",
        paragraphs: [
          "Start both development processes from the repository root. The desktop window opens the shared web app; sign in there and confirm a workspace route loads before testing native-only behavior.",
        ],
        code: "corepack pnpm dev:desktop\n\n# Optional backend override:\n# PowerShell: $env:SUPASTACK_APP_URL = 'https://app.example.com'\n# macOS/Linux: SUPASTACK_APP_URL=https://app.example.com corepack pnpm dev:desktop",
      },
      {
        id: "verify",
        title: "Verify the shell against the web app",
        paragraphs: [
          "Check sign-in, a workspace route, tray hide/show, the summon shortcut and second-instance focus. The shell accepts only credential-free HTTP(S) backend URLs; invalid runtime values fall back to a valid compile-time or localhost URL.",
          "A local build verifies compilation on this host, not signed commercial distribution. Deep-link routing and safe external navigation have their own platform acceptance checklist.",
        ],
        links: [{ href: "/docs/desktop/native-behavior", label: "Native behavior" }],
      },
    ],
    "desktop",
  ),
  feature(
    "desktop/native-behavior",
    "Desktop",
    "Windows, tray & shortcuts",
    "Customize native Tauri behavior in Rust while reusing the web product, with explicit URL navigation, summon shortcuts and offline recovery.",
    [
      {
        id: "window",
        title: "Keep shell behavior in Rust",
        paragraphs: [
          "`src-tauri/src/lib.rs` creates the main 1200×800 webview window. Closing hides it to the tray; Quit exits. Native menus provide Home/Back/Forward/Reload, zoom/fullscreen and window actions. Window-state restoration preserves size/position.",
        ],
      },
      {
        id: "navigation",
        title: "Handle links and summon",
        paragraphs: [
          "The shell accepts `supastack://` routes and resolves them against the exact configured HTTP(S) app origin. For example, `supastack:///settings/appearance?preview=1#main` becomes `/workspace/settings?tab=billing#plans`; `supastack:///auth/callback?code=...` maps to `/auth/callback?code=...`. Query strings and fragments are preserved.",
          "Startup links are applied before the first window is shown. macOS runtime links use Tauri's `on_open_url`; Windows and Linux second-instance arguments use the single-instance callback with its `deep-link` feature enabled. Valid links focus and navigate the existing window.",
          "Only credential-free HTTP(S) links with the exact configured scheme, host, and effective port stay in the shell. Credential-free HTTP(S), `mailto:`, and `tel:` links may open externally; malformed links, credentials, unsupported schemes, ports on custom links, and traversal attempts are rejected. The configured backend URL also rejects credentials and falls back to the next valid/default origin.",
        ],
        code: "SUPASTACK_APP_URL=https://your-app.example\nSUPASTACK_DESKTOP_HOTKEY=CmdOrCtrl+Shift+Space\n\nsupastack:///settings/appearance?preview=1#main\n# Opens https://your-app.example/workspace/settings?tab=billing#plans",
      },
      {
        id: "offline",
        title: "Verify platform-specific behavior",
        paragraphs: [
          "The injected offline overlay offers Retry, hides on online and reloads the web app. Test focus, shortcuts, menu zoom, tray and deep-link invocation on every target OS; unit URL checks alone do not prove those native interactions.",
        ],
        links: [{ href: "/docs/desktop/distribution", label: "Desktop acceptance" }],
      },
    ],
    "desktop",
  ),
  feature(
    "desktop/distribution",
    "Desktop",
    "Desktop builds & distribution",
    "Build the Tauri workspace, configure product identifiers and icons, and separate local compilation from signed installer and native-platform acceptance.",
    [
      {
        id: "configure",
        title: "Configure the product shell",
        paragraphs: [
          "Review `src-tauri/tauri.conf.json`, Cargo metadata, capabilities and platform identifiers. Replace app icons through the shared asset process and set the intended backend URL at build/runtime. The hosted web app must already be deployed and reachable.",
        ],
      },
      {
        id: "build",
        title: "Run the native build gate",
        paragraphs: [
          "These package commands run Rust typecheck and tests, validate release settings, and build the Tauri installer. Signing and distribution configuration depend on the target platform and your account/certificates; do not store signing material in source.",
        ],
        code: "corepack pnpm --filter @supastack/desktop typecheck\ncorepack pnpm --filter @supastack/desktop test\ncorepack pnpm --filter @supastack/desktop check:release-config\ncorepack pnpm --filter @supastack/desktop build",
      },
      {
        id: "accept",
        title: "Verify the installer on the target OS",
        paragraphs: [
          "Check clean install, launch, backend reachability, auth, menus/tray, hotkey registration, second instance, deep links, update checks, launch-at-login, offline retry and uninstall. Verify each supported OS separately. A local build does not prove signed or notarized commercial distribution; code signing, notarization, and release automation are not included — the updater endpoint and signing key are injected at build time.",
        ],
        links: [
          { href: "/docs/desktop/native-behavior", label: "Native acceptance checklist" },
          { href: "/docs/web/deployment", label: "Deploy the shared backend" },
        ],
      },
    ],
    "desktop",
  ),
  feature(
    "mobile/api-surface",
    "Mobile",
    "Mobile screens & API surface",
    "Trace Expo workspace, settings, chat and billing surfaces to their authenticated Next.js BFF routes and server-owned policies.",
    [
      {
        id: "screens",
        title: "Understand native scope",
        paragraphs: [
          "Expo includes native auth/session and deep links alongside workspace, settings, chat, and RevenueCat purchase surfaces. Shared business behavior and authorization stay in the web backend/packages; native clients under `apps/mobile/src` call those APIs without embedding provider credentials.",
        ],
      },
      {
        id: "bff",
        title: "Use the session-authenticated BFF",
        paragraphs: [
          "The `/api/mobile` routes cover entitlement, RevenueCat purchase availability and server sync, organization, members, invitations, audit, API keys, webhooks, domains, schedules and feature requests. They preserve workspace ownership and role checks. They are different from the `sk_` bearer-key `/api/v1` public contract.",
          "Use your device-reachable `EXPO_PUBLIC_API_URL` and the configured origin/scheme; public Expo variables never contain provider credentials.",
        ],
      },
      {
        id: "verify",
        title: "Verify on native targets",
        paragraphs: [
          "Check loading/error/empty states, reconnect, expired session, forbidden management actions and deep-link returns on the device/build you intend to support. An Expo export proves bundling, not native delivery or purchase acceptance.",
        ],
        links: [
          { href: "/docs/reference/api-routes", label: "All API routes" },
          { href: "/docs/mobile/authentication", label: "Native session flow" },
        ],
      },
    ],
    "mobile",
  ),
  feature(
    "deploy/docker",
    "Deployment",
    "Docker & Compose",
    "Run the app with Postgres and optional MinIO through the shipped Dockerfile and Compose profiles, with migrations and production-secret configuration.",
    [
      {
        id: "local",
        title: "Start the local database",
        paragraphs: [
          "The root Compose file includes Postgres using the default `.env.example` local connection. The optional `storage` profile starts MinIO and `app` profile builds/runs the application. Review the Compose ports/volumes before enabling a profile.",
        ],
        code: "docker compose up -d postgres\ncorepack pnpm --filter @supastack/db db:migrate\n# Optional local storage:\ndocker compose --profile storage up -d",
      },
      {
        id: "production",
        title: "Configure the production container",
        paragraphs: [
          "Use the root Dockerfile and deployment guide, provide production environment values at runtime and keep persistence in durable volumes/managed services. Set the public HTTPS origin, migrate the database and configure trusted reverse-proxy hops before accepting traffic.",
          "An app container does not automatically deploy Trigger.dev workers, create provider webhooks or run recurring ticks. Configure those enabled surfaces explicitly.",
        ],
      },
      {
        id: "verify",
        title: "Verify persistence and dependencies",
        paragraphs: [
          "Check health, auth, restart persistence, upload retrieval, provider callbacks and jobs. Back up database volumes before migrations or upgrades.",
        ],
        links: [
          { href: "/docs/deploy/coolify-vps", label: "Coolify VPS recipe" },
          { href: "/docs/web/deployment", label: "Release checklist" },
          { href: "/docs/modules/schedules", label: "Scheduler driver" },
        ],
      },
    ],
  ),
  feature(
    "deploy/managed-hosting",
    "Deployment",
    "Managed web hosting",
    "Build and run the Next.js workspace on your host with a migrated database, validated server configuration, public origin and enabled-provider acceptance.",
    [
      {
        id: "build",
        title: "Use the shipped Next.js build",
        paragraphs: [
          "Configure your host to install the pnpm workspace and build `@supastack/web`. Read `docs/deployment.md` for the standalone/container packaging path; shared packages must be available in the build context.",
        ],
        code: "corepack pnpm install\ncorepack pnpm --filter @supastack/web build\ncorepack pnpm --filter @supastack/web start",
      },
      {
        id: "services",
        title: "Prepare the server dependencies",
        paragraphs: [
          "Set `APP_ENV=production`, a public HTTPS `APP_URL`, auth/encryption secrets, migrated Postgres and real providers for the features you enable. Serverless transaction poolers disable prepared statements; use the session/direct connection for migrations.",
          "Register OAuth callbacks and billing webhooks at the deployed origin, configure shared rate-limit storage and trusted proxy count, and separately deploy Trigger.dev tasks if selected.",
        ],
      },
      {
        id: "accept",
        title: "Check the deployed flow",
        paragraphs: [
          "Verify health, sign-in, workspace isolation, paid access, uploads, jobs and email against the real services. Builds and fake/local tests establish different gates; record the enabled-provider acceptance separately.",
        ],
        links: [
          { href: "/docs/web/deployment", label: "Deployment checklist" },
          { href: "/docs/deploy/supabase-cloud", label: "Managed Postgres" },
          { href: "/docs/security/health", label: "Health endpoints" },
        ],
      },
    ],
  ),
  feature(
    "security/workspace-isolation",
    "Security & operations",
    "Workspace isolation",
    "Resolve the caller's active workspace on the server and scope every user-owned read, write, tool call, job, and exported record to verified ownership.",
    [
      {
        id: "resolve",
        title: "Resolve membership before data",
        paragraphs: [
          "The session chooses identity; the server resolves active workspace and verifies membership/role. Every user-owned record uses `workspaceId`. A client field, URL ID or model-selected argument cannot replace that ownership check.",
          "Platform marketing assets and platform admin records have explicit platform scope; do not invent a workspace for anonymous waitlist entries.",
        ],
      },
      {
        id: "propagate",
        title: "Carry the boundary through asynchronous work",
        paragraphs: [
          "Tasks, jobs, tool context, API keys, content, storage and outbound events inherit the authenticated workspace. Check resource IDs together with ownership. Allowing a valid ID from another workspace is still an authorization failure.",
        ],
      },
      {
        id: "verify",
        title: "Write denial tests first",
        paragraphs: [
          "Pair every successful mutation/read with anonymous, foreign-workspace and insufficient-role tests. Never expose secrets while diagnosing a forbidden result.",
        ],
        links: [
          { href: "/docs/modules/workspaces", label: "Workspace contracts" },
          { href: "/docs/tutorials/protected-page", label: "Protected-page recipe" },
          { href: "/docs/modules/workspace-tools", label: "Server-injected tool context" },
        ],
      },
    ],
  ),
  feature(
    "security/rate-limiting",
    "Security & operations",
    "Rate limits & public AI budget",
    "Configure shared fixed-window API limits, controlled-proxy IP resolution, and the platform's daily public-AI spend cap.",
    [
      {
        id: "store",
        title: "Choose the limiter store",
        paragraphs: [
          "`RATE_LIMIT_STORE` is memory or postgres. When unset, production selects Postgres and other environments select memory. Shared `rate_limit_bucket` rows coordinate multiple servers; store failures currently fail open to preserve API availability.",
          "Workspace/user AI submission limits and the public API/MCP limiter protect their separate surfaces. Preserve the existing caller-specific bucket keys when adding routes.",
        ],
      },
      {
        id: "proxy",
        title: "Trust only controlled proxy hops",
        paragraphs: [
          "`TRUSTED_PROXY_COUNT` ranges from 0–10 and counts reverse proxies that append `x-forwarded-for`. Zero trusts none and uses a shared unknown bucket; one controlled proxy typically needs 1. An incorrect count lets untrusted forwarded values affect the limiter.",
        ],
      },
      {
        id: "budget",
        title: "Limit anonymous provider spend",
        paragraphs: [
          "`PUBLIC_AI_DAILY_BUDGET_MICROUNITS=0` disables public AI calls. A configured nonnegative daily UTC cap reserves platform spend before provider calls and is separate from each workspace's budget. Test concurrent reservations, reset boundaries and denial before any billable provider attempt.",
        ],
        code: "RATE_LIMIT_STORE=postgres\nTRUSTED_PROXY_COUNT=1\nPUBLIC_AI_DAILY_BUDGET_MICROUNITS=0",
      },
    ],
  ),
  feature(
    "security/turnstile",
    "Security & operations",
    "Turnstile bot protection",
    "Enable Cloudflare Turnstile on public lead forms and Better Auth credential endpoints, with a public site key and server-only verification secret.",
    [
      {
        id: "configure",
        title: "Enable both keys",
        paragraphs: [
          "`CAPTCHA_PROVIDER=off` is the default. Select `turnstile`, configure the matching hostname in your Turnstile application and provide both keys. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is public; `TURNSTILE_SECRET_KEY` is used only by the server verifier.",
        ],
        code: "CAPTCHA_PROVIDER=turnstile\nNEXT_PUBLIC_TURNSTILE_SITE_KEY=your-site-key\n# TURNSTILE_SECRET_KEY belongs in the server secret store.",
      },
      {
        id: "coverage",
        title: "Preserve the protected surfaces",
        paragraphs: [
          "The gate covers contact/newsletter forms and Better Auth sign-in, sign-up, OTP and password-reset credential endpoints. It complements validation/rate limiting; it is not a substitute for sessions or workspace authorization.",
        ],
      },
      {
        id: "verify",
        title: "Verify rejection and recovery",
        paragraphs: [
          "Test a valid token, missing/expired/invalid token, verifier failure and a retry after the client widget resets. Keep actionable human-check copy and keyboard access; inspect the chosen auth engine's coverage before switching providers.",
        ],
        links: [
          { href: "/docs/modules/marketing-forms", label: "Protected forms" },
          { href: "/docs/modules/authjs", label: "Auth engine differences" },
        ],
      },
    ],
  ),
  feature(
    "security/secrets",
    "Security & operations",
    "Secrets, encryption & redaction",
    "Keep provider and signing credentials on the server, encrypt workspace keys/tokens, and carry safe identifiers rather than raw secret material through diagnostics.",
    [
      {
        id: "environment",
        title: "Separate client and server configuration",
        paragraphs: [
          "Only deliberately public configuration belongs in `NEXT_PUBLIC_` or `EXPO_PUBLIC_`. Auth secrets, database credentials, billing keys/webhook secrets, email credentials, AI keys, Trigger keys and encryption material are server-only. Never print real environment files in setup diagnostics.",
        ],
      },
      {
        id: "vault",
        title: "Protect encrypted records",
        paragraphs: [
          "BYOK and connected-account tokens use the server credential vault. Preserve the active encryption key when deploying and plan any key rotation as a data migration. Return sanitized account/provider status to clients, never decrypted keys.",
        ],
      },
      {
        id: "logs",
        title: "Use safe observability context",
        paragraphs: [
          "Use correlation/task/workspace IDs and redacted structured logging. Inspect error, alert and webhook payloads before adding fields. Tests should exercise redaction and foreign-workspace denial alongside ordinary failures.",
        ],
        links: [
          { href: "/docs/modules/observability", label: "Safe diagnostics" },
          { href: "/docs/modules/byok", label: "Encrypted workspace keys" },
        ],
      },
    ],
  ),
  feature(
    "security/privacy",
    "Security & operations",
    "Privacy, exports & retention",
    "Map product data to the shipped account export and policy scaffolds, then define retention, removal, and provider handling for your actual product.",
    [
      {
        id: "inventory",
        title: "Inventory your product data",
        paragraphs: [
          "Review identity/session, workspace, tasks/usage, content, commerce, connected accounts, notifications, audit and marketing records. Adding a product table means deciding how it participates in export and retention, not only writing its migration.",
        ],
      },
      {
        id: "export",
        title: "Preserve authenticated exports",
        paragraphs: [
          "`GET /api/account/export` is signed-in account export. Follow the existing implementation when adding authored/user-owned data and keep secret vaults, signing material and foreign private records out of its response. Define deletion/retention behavior separately; an export endpoint is not an automatic compliance certification.",
        ],
      },
      {
        id: "policy",
        title: "Keep policies aligned with behavior",
        paragraphs: [
          "Update your product's privacy/contact/legal content to match actual storage, provider handling and support process. Configure PostHog/Sentry deliberately and never send keys, tokens or sensitive bodies to telemetry.",
        ],
        links: [
          { href: "/docs/web/legal-pages", label: "Policy scaffolds" },
          { href: "/docs/modules/sessions", label: "Account security" },
          { href: "/docs/modules/observability", label: "Telemetry" },
        ],
      },
    ],
  ),
  feature(
    "security/health",
    "Security & operations",
    "Health & status",
    "Use the shipped health endpoint and public status surface to check the deployed application without exposing private operational details.",
    [
      {
        id: "endpoint",
        title: "Check application reachability",
        paragraphs: [
          "`GET /api/health` and `/status` are the shipped health/status surfaces. Use the endpoint for your host's health probe and inspect its implementation before promising checks on every external integration.",
        ],
      },
      {
        id: "diagnostics",
        title: "Follow failures to the right boundary",
        paragraphs: [
          "Reachable HTTP does not prove database migrations, auth callback correctness, paid-access processing, worker completion or inbox delivery. Use structured correlation IDs and each service's acceptance checks to identify the failed boundary.",
        ],
      },
      {
        id: "verify",
        title: "Verify healthy and failed states",
        paragraphs: [
          "Check your deployed URL, health response, status page and safe failure presentation. Keep provider credentials, database hosts/passwords and private stack traces out of public diagnostics.",
        ],
        links: [
          { href: "/docs/web/troubleshooting", label: "Troubleshooting" },
          { href: "/docs/modules/observability", label: "Errors and alerts" },
        ],
      },
    ],
  ),
];
