import type { Guide, Section } from "./content";
import { groupGuides } from "./docs-navigation";

function guide(
  slug: string,
  title: string,
  description: string,
  sections: readonly Section[],
): Guide {
  const instructions = referenceInstructions[slug];
  return {
    slug,
    tab: "modules",
    group: "Reference",
    title,
    description,
    sections: instructions ? [instructions, ...sections] : sections,
  };
}

const referenceInstructions: Readonly<Record<string, Section>> = {
  "reference/environment": {
    id: "how-to-edit",
    title: "How to use this configuration reference",
    paragraphs: [
      "An environment variable is a named setting written as KEY=value. Start with the local tutorial before changing providers. Open apps/web/.env.local in the editor for Web settings, apps/mobile/.env.local for public phone settings, and root .env for database migration commands. Changing only root .env does not configure the Web or Mobile app.",
      "Find the key you need in the table, follow its provider's setup guide, replace the corresponding value in the correct file and save. The example below belongs in the Web configuration file, not in a terminal. Keep blank credentials blank while that provider is disabled. Restart the app after changing environment values.",
      "NEXT_PUBLIC_ and EXPO_PUBLIC_ values are shipped to the browser or phone and may contain only public configuration. Provider API keys, passwords and signing secrets belong on the server. When deploying, enter those settings in the host's environment dashboard rather than committing local .env files. Tables below describe every available setting; you do not need to fill every key to start.",
    ],
    code: "# File: apps/web/.env.local\nAPP_ENV=local\nAI_PROVIDER=fake\nBILLING_PROVIDER=local\nEMAIL_PROVIDER=local\nJOB_PROVIDER=local",
    links: [
      {
        href: "/docs/web/terminal-basics",
        label: "Learn how to edit and save configuration files",
      },
      { href: "/docs/web/configuration", label: "Make and verify one configuration change" },
    ],
  },
  "reference/commands": {
    id: "how-to-run",
    title: "How to choose and run a command",
    paragraphs: [
      "A script is a named command recorded in package.json. Open the repository root in the editor, select Terminal → New Terminal and use corepack pnpm followed by the script name. The examples below start one app at a time; choose only the app whose folder is present in your checkout. Leave a development server's terminal running while you use its preview.",
      "--filter selects the package named after it; for example @supastack/web is apps/web. dev starts a live preview, build prepares release files on this computer, typecheck reports type errors, and test runs automated checks. A successful build does not publish anything. To stop a preview press Ctrl + C in its terminal, then wait for the prompt.",
      "The root-script inventory describes the All Platforms monorepo. Platform-only repositories expose a smaller set and their root dev/build scripts target that platform. If a listed root script is missing, use the named app's filtered command or inspect your root package.json rather than adding scripts from another platform. Desktop checks need Rust; Mobile and Desktop clients also need a separately running Web backend.",
    ],
    code: "# Web preview:\ncorepack pnpm --filter @supastack/web dev\n\n# Mobile preview (separate terminal):\ncorepack pnpm --filter @supastack/mobile start\n\n# Desktop window (separate terminal; Rust required):\ncorepack pnpm --filter @supastack/desktop dev",
    links: [
      { href: "/docs/web/before-you-start", label: "Prepare Node, Git and Corepack" },
      { href: "/docs/web/terminal-basics", label: "Learn terminal and server basics" },
    ],
  },
  "reference/packages": {
    id: "how-to-find",
    title: "Find the files for the feature you want to change",
    paragraphs: [
      "A package is a folder of reusable code. An app is the runnable Web, Mobile or Desktop surface. Open the project in your editor and use the Source path column below to expand the matching folders. The @supastack/name label is used in imports and --filter commands; it is not a website or a folder you must download separately.",
      "For a product name or homepage text, begin with apps/web/src/marketing/site-config.ts. For a Web page, begin under apps/web/app; for a Mobile screen, under apps/mobile/app. Desktop window behavior lives in apps/desktop/src-tauri/src/lib.rs, while its displayed product UI still comes from the Web app. Shared data and provider logic lives under packages.",
      "If you use a coding agent, give it the feature, the relevant app/package paths and the behavior you expect. Ask it to read the existing implementation and .ai mirror first, make a small change and run the affected app's typecheck and tests. A platform-only checkout includes only its shipped apps and required shared packages, so some monorepo paths below will be absent.",
    ],
    links: [
      { href: "/docs/web/project-structure", label: "Understand the project folder structure" },
      { href: "/docs/web/branding", label: "Start with a simple branding change" },
    ],
  },
  "reference/api-routes": {
    id: "how-to-read",
    title: "Read this API table before making a request",
    paragraphs: [
      "An API route is a server address used by the app to perform an action. GET reads a resource; POST submits an action or creates data; PATCH changes data; DELETE removes it. These labels describe the HTTP method, not commands to paste into a terminal. A path containing [taskId] or [id] needs the actual record ID, not the brackets.",
      "Begin with the public OpenAPI address below in your browser while the Web server is running. You should see a JSON document describing the versioned API. A protected route may return 401 before sign-in; that is expected. Opening a POST route in the browser sends GET and can return 405 because the method is wrong. Follow Public API for authenticated requests and scoped keys instead of guessing request bodies.",
      "Session means the browser has signed in. Bearer API key means a request includes an authorized secret key bound to a workspace. Provider signature and internal secret routes are for service callbacks, not public user forms. Do not test DELETE or write methods against customer records. Use a disposable local workspace and the corresponding feature guide.",
    ],
    code: "http://localhost:3000/api/v1/openapi",
    links: [
      {
        href: "/docs/modules/public-api",
        label: "Create a scoped API key and make an authenticated request",
      },
    ],
  },
};

export const referenceGuides: readonly Guide[] = [
  guide(
    "reference/environment",
    "Environment variables",
    "A complete index of the shipped .env.example settings, including optional integrations and commented configuration keys.",
    [
      {
        id: "five-minute-local-setup",
        title: "Start with the local defaults",
        paragraphs: [
          "Follow the main five-minute setup to install dependencies and launch the credential-free local app with fake and local adapters. The checked-in environment example contains placeholders; never copy values from somebody else's environment.",
          "The first local interface does not need provider accounts, Postgres, or a Docker service. Docker, Postgres, and migrations belong to the later persisted-data path. Keep AI_PROVIDER=fake and the other local providers while you build the first flow, then select hosted providers only when the product needs them.",
        ],
        links: [
          {
            href: "/docs/web/local-setup",
            label: "Set up in 5 minutes",
            description: "Follow the main guided install and first-run checklist.",
          },
          {
            href: "/docs/reference/commands",
            label: "Workspace commands",
            description: "See root and app-level commands.",
          },
          {
            href: "/docs/web/database",
            label: "Continue: configure Postgres and run migrations",
            description: "Add persistent accounts and workspace data when you need them.",
          },
        ],
      },
      {
        id: "application-and-authentication",
        title: "Application, identity, and sign-in",
        paragraphs: [
          "Set the application origin and database connection before deploying. Better Auth is the default engine. OAuth sign-in remains disabled until both its enable flag and provider credentials are configured; connected accounts are a separate workspace feature with separate OAuth credentials.",
          "Server credentials stay server-side. The public EXPO_PUBLIC_* and NEXT_PUBLIC_* values are intentionally shipped to clients, so never put secrets in them. CREDENTIAL_ENCRYPTION_KEY protects encrypted provider credentials; AUTH_SECRET signs authentication state.",
        ],
        table: {
          head: ["Variables", "Purpose"],
          rows: [
            ["APP_ENV", "Names the application environment used by configuration and telemetry."],
            [
              "NODE_ENV",
              "Node.js runtime mode; production mode also affects the default rate-limit store.",
            ],
            ["APP_URL", "Canonical web origin for authentication callbacks and generated links."],
            [
              "DATABASE_URL",
              "PostgreSQL connection string used by the application and migrations.",
            ],
            [
              "POSTGRES_PASSWORD",
              "Password for the self-hosted Postgres Compose service. The local fallback is development-only; production requires a unique generated password that matches DATABASE_URL.",
            ],
            [
              "DATABASE_POOLER",
              "Declares transaction-pooler use so PostgreSQL connections avoid prepared statements.",
            ],
            [
              "AUTH_PROVIDER",
              "Selects Better Auth (default) or the Auth.js v5 authentication engine.",
            ],
            ["AUTH_SECRET", "Server-only secret used to sign authentication state and tokens."],
            [
              "CREDENTIAL_ENCRYPTION_KEY",
              "32-byte base64 key used to encrypt stored provider credentials.",
            ],
            [
              "AUTH_GOOGLE_ENABLED, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET",
              "Enable Google sign-in and configure its OAuth application.",
            ],
            [
              "AUTH_GITHUB_ENABLED, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET",
              "Enable GitHub sign-in and configure its OAuth application.",
            ],
            [
              "AUTH_APPLE_ENABLED, APPLE_CLIENT_ID, APPLE_CLIENT_SECRET",
              "Enable Apple sign-in and configure its OAuth application.",
            ],
            [
              "AUTH_TWITTER_ENABLED, TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET",
              "Enable X sign-in and configure its OAuth application.",
            ],
            [
              "AUTH_MICROSOFT_ENABLED, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET",
              "Enable Microsoft sign-in and configure its OAuth application.",
            ],
            [
              "CONNECTED_X_CLIENT_ID, CONNECTED_X_CLIENT_SECRET",
              "Configure X workspace-account connections; the secret is optional for PKCE-only clients.",
            ],
            [
              "CONNECTED_GOOGLE_CLIENT_ID, CONNECTED_GOOGLE_CLIENT_SECRET",
              "Configure Google workspace-account connections; both credentials are required.",
            ],
            [
              "CONNECTED_MICROSOFT_CLIENT_ID, CONNECTED_MICROSOFT_CLIENT_SECRET",
              "Configure Microsoft workspace-account connections; both credentials are required.",
            ],
            [
              "ADMIN_EMAILS",
              "Comma-separated email addresses granted the platform admin role at signup.",
            ],
            [
              "EARLY_ACCESS_INVITE_ONLY",
              "Requires a valid early-access invitation code for new account creation when true.",
            ],
            ["EXPO_PUBLIC_API_URL", "Public API origin used by the Expo application."],
            [
              "EXPO_PUBLIC_APP_SCHEME",
              "Deep-link scheme used by the mobile app for authentication returns.",
            ],
            [
              "MOBILE_ALLOWED_ORIGINS",
              "Comma-separated exact mobile client origins allowed by production configuration; wildcard origins are rejected.",
            ],
            [
              "EXPO_ACCESS_TOKEN",
              "Optional server-only Expo push credential; enables authenticated push delivery when set.",
            ],
            [
              "SUPASTACK_APP_URL",
              "Web app URL loaded by the Tauri desktop shell at runtime or compile time.",
            ],
            [
              "SUPASTACK_DESKTOP_HOTKEY",
              "Optional Tauri accelerator override for the desktop summon shortcut.",
            ],
            [
              "SUPASTACK_UPDATER_ENDPOINT, SUPASTACK_UPDATER_PUBKEY",
              "Desktop release update feed and minisign public key injected as a build-time config overlay; both are required together. Endpoint templates may contain a {{channel}} placeholder for stable/beta feeds.",
            ],
            [
              "SUPASTACK_UPDATE_CHANNEL",
              "Optional desktop runtime override (stable or beta) that supersedes the persisted update-channel choice for the current run.",
            ],
          ],
        },
      },
      {
        id: "mobile-purchases",
        title: "Native in-app purchases",
        paragraphs: [
          "Native purchases are separate from BILLING_PROVIDER: the Expo client uses RevenueCat only when the server enables it, and the server verifies current store state before updating the shared entitlement ledger.",
          "MOBILE_PURCHASES_PROVIDER=off disables server verification; revenuecat enables it. Set the Expo public mode to off, revenuecat, or fake (fake is development-only). Public iOS and Android SDK keys may ship in the app; REVENUECAT_SECRET_API_KEY and REVENUECAT_WEBHOOK_AUTHORIZATION stay server-only. Configure the RevenueCat entitlement ID and app entitlement key to match the project. Sandbox grants are refused in production.",
        ],
        table: {
          head: ["Variables", "Purpose"],
          rows: [
            ["MOBILE_PURCHASES_PROVIDER", "Server-side purchase verification: off or revenuecat."],
            [
              "EXPO_PUBLIC_MOBILE_PURCHASES_PROVIDER",
              "Expo client mode: off, revenuecat, or fake; fake is development-only.",
            ],
            [
              "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY, EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY",
              "Platform public SDK keys used by the native RevenueCat client.",
            ],
            [
              "REVENUECAT_SECRET_API_KEY",
              "Server-only RevenueCat API credential used to fetch current subscriber state.",
            ],
            [
              "REVENUECAT_WEBHOOK_AUTHORIZATION",
              "Exact Authorization header value expected on RevenueCat webhook requests.",
            ],
            [
              "REVENUECAT_ENTITLEMENT_ID, REVENUECAT_ENTITLEMENT_KEY",
              "RevenueCat entitlement identifier and application entitlement key; defaults are pro and ai.reference-task.",
            ],
            [
              "REVENUECAT_ALLOW_SANDBOX",
              "Allows sandbox verification outside production; production always rejects sandbox grants.",
            ],
          ],
        },
      },
      {
        id: "ai-and-email-providers",
        title: "AI, agents, and email",
        paragraphs: [
          "Fake AI and local email are deterministic development defaults. Real AI providers are chosen server-side, and model IDs and prices come from the database catalog rather than environment variables. Agent framework selection changes the server-side adapter while preserving the shared workspace tools.",
          "EMAIL_PROVIDER=local records messages in the local outbox. The other transports are transactional email integrations; their credentials remain server-only. Do not route product messages through an outreach sender.",
        ],
        table: {
          head: ["Variables", "Purpose"],
          rows: [
            [
              "AI_PROVIDER",
              "Selects fake, OpenAI, Anthropic, OpenAI-compatible, or OpenRouter model requests.",
            ],
            [
              "AI_MODEL_POLICY",
              "Optional JSON model allow-list for the fast, smart, and cheap aliases; an empty alias disables it.",
            ],
            [
              "AGENT_FRAMEWORK",
              "Selects the ai-sdk, Mastra, LangGraph, or OpenAI Agents runner adapter.",
            ],
            ["OPENAI_API_KEY", "Server API credential for the OpenAI provider."],
            ["ANTHROPIC_API_KEY", "Server API credential for the Anthropic provider."],
            [
              "OPENAI_COMPATIBLE_API_KEY, OPENAI_COMPATIBLE_BASE_URL",
              "Credential and endpoint for an OpenAI-compatible provider.",
            ],
            ["OPENROUTER_API_KEY", "Server API credential required when AI_PROVIDER=openrouter."],
            [
              "OPENROUTER_APP_NAME, OPENROUTER_SITE_URL",
              "Optional OpenRouter attribution values sent as X-Title and HTTP-Referer.",
            ],
            [
              "EMAIL_PROVIDER",
              "Selects local, Resend, SES, Postmark, SendGrid, Mailgun, SMTP, or Brevo delivery.",
            ],
            ["EMAIL_FROM", "Default sender name and email address for transactional messages."],
            ["RESEND_API_KEY", "Server API credential for Resend email delivery."],
            [
              "AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN",
              "AWS region and server credentials used by the SES email transport.",
            ],
            ["POSTMARK_SERVER_TOKEN", "Server credential for Postmark email delivery."],
            ["SENDGRID_API_KEY", "Server credential for SendGrid email delivery."],
            [
              "MAILGUN_API_KEY, MAILGUN_DOMAIN, MAILGUN_REGION",
              "Mailgun credential, sending domain, and optional US or EU API region.",
            ],
            [
              "SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE",
              "SMTP connection, login, port, and TLS mode for the mail server.",
            ],
            ["BREVO_API_KEY", "Server credential for Brevo email delivery."],
          ],
        },
      },
      {
        id: "billing-providers",
        title: "Billing providers and plan identifiers",
        paragraphs: [
          "BILLING_PROVIDER selects one adapter behind the shared checkout, portal, and signed-webhook contract. Local billing is the no-credentials development mode. Configure the default product or price for the selected provider; optional per-plan identifiers override the default mapping for Pro monthly, Pro yearly, and lifetime plans.",
          "Webhook secrets and API credentials belong in a server-side secret store. Point provider dashboards at the matching /api/billing/webhook path and use each adapter's expected signature headers. Sandbox or test-mode flags keep provider configuration in its test environment.",
        ],
        table: {
          head: ["Variables", "Purpose"],
          rows: [
            [
              "BILLING_PROVIDER",
              "Selects local, Stripe, Lemon Squeezy, Creem, Polar, Whop, Paddle, Dodo, or PayPal.",
            ],
            [
              "STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID",
              "Stripe server credential, signature secret, and default price.",
            ],
            [
              "STRIPE_PRICE_ID_PRO, STRIPE_PRICE_ID_PRO_YEARLY, STRIPE_PRICE_ID_LIFETIME",
              "Optional Stripe price identifiers for Pro monthly, Pro yearly, and lifetime plans.",
            ],
            [
              "LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_STORE_ID, LEMONSQUEEZY_VARIANT_ID, LEMONSQUEEZY_WEBHOOK_SECRET",
              "Lemon Squeezy server credential, store, default variant, and webhook signature secret.",
            ],
            [
              "CREEM_API_KEY, CREEM_PRODUCT_ID, CREEM_WEBHOOK_SECRET, CREEM_TEST_MODE",
              "Creem server credential, default product, webhook secret, and sandbox selector.",
            ],
            [
              "CREEM_PRODUCT_ID_PRO, CREEM_PRODUCT_ID_PRO_YEARLY, CREEM_PRODUCT_ID_LIFETIME",
              "Optional Creem product identifiers for Pro monthly, Pro yearly, and lifetime plans.",
            ],
            [
              "POLAR_ACCESS_TOKEN, POLAR_PRODUCT_ID, POLAR_WEBHOOK_SECRET, POLAR_SERVER",
              "Polar access token, default product, webhook secret, and sandbox or production server.",
            ],
            [
              "POLAR_PRODUCT_ID_PRO, POLAR_PRODUCT_ID_PRO_YEARLY, POLAR_PRODUCT_ID_LIFETIME",
              "Optional Polar product identifiers for Pro monthly, Pro yearly, and lifetime plans.",
            ],
            [
              "WHOP_API_KEY, WHOP_PLAN_ID, WHOP_WEBHOOK_SECRET",
              "Whop server credential, default plan, and webhook secret.",
            ],
            [
              "WHOP_PLAN_ID_PRO, WHOP_PLAN_ID_PRO_YEARLY, WHOP_PLAN_ID_LIFETIME",
              "Optional Whop plan identifiers for Pro monthly, Pro yearly, and lifetime plans.",
            ],
            [
              "PADDLE_API_KEY, PADDLE_PRICE_ID, PADDLE_WEBHOOK_SECRET, PADDLE_ENVIRONMENT",
              "Paddle server credential, default price, webhook secret, and sandbox or production mode.",
            ],
            [
              "PADDLE_PRICE_ID_PRO, PADDLE_PRICE_ID_PRO_YEARLY, PADDLE_PRICE_ID_LIFETIME",
              "Optional Paddle price identifiers for Pro monthly, Pro yearly, and lifetime plans.",
            ],
            [
              "DODO_PAYMENTS_API_KEY, DODO_PRODUCT_ID, DODO_PAYMENTS_WEBHOOK_KEY, DODO_PAYMENTS_ENVIRONMENT",
              "Dodo server credential, default product, webhook key, and test or live mode.",
            ],
            [
              "DODO_PRODUCT_ID_PRO, DODO_PRODUCT_ID_PRO_YEARLY, DODO_PRODUCT_ID_LIFETIME",
              "Optional Dodo product identifiers for Pro monthly, Pro yearly, and lifetime plans.",
            ],
            [
              "PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_PLAN_ID, PAYPAL_WEBHOOK_ID, PAYPAL_ENVIRONMENT",
              "PayPal OAuth credentials, default plan, webhook id, and sandbox or live mode.",
            ],
            [
              "PAYPAL_PLAN_ID_PRO, PAYPAL_PLAN_ID_PRO_YEARLY, PAYPAL_PLAN_ID_LIFETIME",
              "Optional PayPal plan identifiers for Pro monthly, Pro yearly, and lifetime plans.",
            ],
          ],
        },
      },
      {
        id: "jobs-storage-and-operations",
        title: "Jobs, storage, protection, and operations",
        paragraphs: [
          "The remaining settings turn on optional infrastructure around the app. Memory storage and rate limits are local defaults. For multi-instance production, Postgres rate-limit buckets coordinate requests; S3-compatible storage can point to Supabase Storage or MinIO. Keep proxy trust at zero unless a controlled reverse proxy appends the forwarding header.",
          "Supabase management credentials are used only by the provisioning CLI. The application still connects through DATABASE_URL and uses S3 credentials for object storage. Observability values configure monitoring and failure alerts; alerts contain diagnostic context, so use a server-owned HTTPS receiver.",
        ],
        table: {
          head: ["Variables", "Purpose"],
          rows: [
            ["JOB_PROVIDER", "Selects the local job runner or Trigger.dev workflow adapter."],
            [
              "TRIGGER_SECRET_KEY, TRIGGER_PROJECT_REF",
              "Trigger.dev server credential and project reference for deployed jobs.",
            ],
            [
              "SCHEDULER_TICK_SECRET",
              "Secret for POST /api/internal/scheduler-tick; without it the endpoint stays disabled.",
            ],
            [
              "SCHEDULER_TICK_URL",
              "Optional override for the tick target — defaults to APP_URL, then localhost:3000.",
            ],
            ["STORAGE_PROVIDER", "Selects memory storage or an S3-compatible object store."],
            [
              "STORAGE_BUCKET, STORAGE_REGION",
              "Object-store bucket and region; region defaults to us-east-1.",
            ],
            [
              "STORAGE_ENDPOINT",
              "Optional S3-compatible endpoint, such as Supabase Storage or MinIO.",
            ],
            [
              "MINIO_ROOT_USER",
              "Optional root username for the local MinIO Compose service. Use a unique value when deploying MinIO.",
            ],
            [
              "MINIO_ROOT_PASSWORD",
              "Optional root password for the local MinIO Compose service. Use a unique secret when deploying MinIO.",
            ],
            [
              "STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY",
              "Server credentials required when STORAGE_PROVIDER=s3.",
            ],
            [
              "STORAGE_FORCE_PATH_STYLE",
              "Overrides path-style S3 addressing; an endpoint enables it by default.",
            ],
            ["STORAGE_PUBLIC_BASE_URL", "Optional public CDN base used to form object URLs."],
            ["RATE_LIMIT_STORE", "Selects in-memory or Postgres fixed-window rate-limit buckets."],
            [
              "TRUSTED_PROXY_COUNT",
              "Number of controlled forwarding proxies trusted when resolving client IPs; defaults to zero.",
            ],
            [
              "PUBLIC_AI_DAILY_BUDGET_MICROUNITS",
              "Platform-wide daily UTC spend cap for anonymous AI; zero disables public AI endpoints.",
            ],
            [
              "CUSTOM_DOMAINS_PROVIDER",
              "Selects off, local, or Cloudflare for SaaS custom-hostname management.",
            ],
            [
              "CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, CUSTOM_DOMAIN_CNAME_TARGET",
              "Cloudflare zone credentials and the customer-facing CNAME target.",
            ],
            [
              "CAPTCHA_PROVIDER, TURNSTILE_SECRET_KEY, NEXT_PUBLIC_TURNSTILE_SITE_KEY",
              "Selects off or Cloudflare Turnstile and configures its server secret and public site key.",
            ],
            [
              "SUPABASE_ACCESS_TOKEN",
              "CLI-only Management API token used by supabase:provision; it is never printed.",
            ],
            ["SENTRY_DSN", "Monitoring destination for Sentry error reporting."],
            [
              "NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_POSTHOG_HOST",
              "Public PostHog project key and ingestion host for client analytics.",
            ],
            [
              "ANALYTICS_PROVIDER, ANALYTICS_SITE_ID, ANALYTICS_HOST",
              "Selects off, local first-party, Plausible, or PostHog site analytics; the site id is required for script providers and the host optionally overrides a self-hosted endpoint.",
            ],
            [
              "ALERT_WEBHOOK_URL",
              "Optional HTTPS receiver for terminal job and webhook-delivery failure alerts.",
            ],
            [
              "MARKETING_INBOX",
              "Notification destination for public contact and newsletter submissions.",
            ],
            [
              "MARKETING_LEAD_STORE",
              "Selects email-only, local JSON, or Firestore persistence for marketing leads.",
            ],
            [
              "MARKETING_LEAD_STORE_PATH",
              "Optional local JSON file path override for persisted marketing leads.",
            ],
            [
              "FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY",
              "Firebase Admin credentials required when marketing lead storage uses Firestore.",
            ],
            ["FIRESTORE_DATABASE", "Optional named Firestore database; defaults to (default)."],
          ],
        },
      },
    ],
  ),
  guide(
    "reference/commands",
    "Commands",
    "Buyer-safe root and workspace scripts for local setup, development, checks, mobile and desktop builds, and database operations.",
    [
      {
        id: "local-workflow",
        title: "Five-minute local workflow",
        paragraphs: [
          "For the first Web run, follow the operating-system-specific local tutorial: create root .env and apps/web/.env.local from .env.example, install dependencies, then start the Web workspace. The Web server reads its app-level file; root .env is used by database migration commands. Do not overwrite configuration files that already exist.",
          "No provider credentials, database service, or Docker install is needed for the initial local reference flow. Add Docker, Postgres, and migrations later when you need persisted accounts and workspace records. Local email, fake AI, local billing, local jobs, memory storage, and CAPTCHA off avoid external services and paid provider calls.",
        ],
        code: [
          "# macOS / Linux; see the Web tutorial for Windows:",
          "cp .env.example .env",
          "cp .env.example apps/web/.env.local",
          "corepack pnpm install",
          "corepack pnpm --filter @supastack/web dev",
        ].join("\n"),
        links: [
          {
            href: "/docs/reference/environment",
            label: "Environment variables",
            description: "Review every setting before switching providers.",
          },
          {
            href: "/docs/reference/packages",
            label: "Workspace packages",
            description: "Find each app and shared package source.",
          },
        ],
      },
      {
        id: "root-scripts",
        title: "Root workspace scripts",
        paragraphs: [
          "Run a script from the repository root. The package manager is pinned to pnpm 11.19.0 and the repository requires Node.js 22 or newer. Scripts that contact an external provider or change a remote account are identified below so local acceptance stays distinct from deployment and billing setup.",
        ],
        items: [
          "`pnpm dev` — starts all development workspaces except the Tauri desktop app.",
          "`pnpm dev:desktop` — starts the web app and Tauri desktop shell together.",
          "`pnpm build` — builds all workspaces except desktop; `pnpm build:desktop` builds the desktop shell.",
          "`pnpm test` and `pnpm test:watch` — run the deterministic Vitest suite once or in watch mode.",
          "`pnpm test:e2e` — runs the local Playwright suite; `pnpm test:e2e:production` uses the production E2E configuration and its explicit target URL.",
          "`pnpm smoke:providers` — runs provider smoke checks from vitest.real.config.ts; configure only the providers you intentionally want contacted.",
          "`pnpm typecheck`, `pnpm typecheck:local`, and `pnpm typecheck:desktop` — typecheck all workspaces, all non-desktop workspaces, or desktop alone.",
          "`pnpm lint` — runs ESLint across the repository.",
          "`pnpm format:check` and `pnpm format` — check formatting or rewrite supported source files with Prettier.",
          "`pnpm check` — runs lint, typecheck, tests, and formatting checks; `pnpm check:local` omits desktop typechecking.",
          "`pnpm verify:local` — runs the local checks, production build, and both Playwright suites.",
          "`pnpm verify:desktop` — typechecks and tests the Rust shell, then builds it with Tauri.",
          "`pnpm jobs:tick` — sends one authenticated tick to the local scheduler endpoint; configure SCHEDULER_TICK_SECRET first.",
          "`pnpm supabase:doctor` — inspects database TLS, pooler mode, migrations, and exposed-table RLS. Its optional `--fix-rls` flag changes database policies.",
          "`pnpm supabase:provision` — prepares a Supabase cloud project through the Management API; without `--yes` it only previews the requested changes.",
          "`pnpm changeset` creates a package change note and `pnpm version:packages` applies pending package versions.",
        ],
      },
      {
        id: "workspace-scripts",
        title: "App and package scripts",
        paragraphs: [
          "Run a package script with `pnpm --filter <workspace-name> <script>`. Typecheck and tests are local operations. Store submission and Trigger.dev deployment scripts publish to external services; use them only after configuring and reviewing the destination account.",
        ],
        table: {
          head: ["Workspace", "Scripts", "Purpose"],
          rows: [
            [
              "@supastack/web",
              "build, dev, start, test, typecheck",
              "Next.js app server, build, and checks.",
            ],
            [
              "@supastack/web",
              "trigger:deploy",
              "Deploys registered background workflows to the configured Trigger.dev project.",
            ],
            [
              "@supastack/mobile",
              "start, android, ios, build, test, typecheck",
              "Expo development, platform launch, static export, and checks.",
            ],
            [
              "@supastack/mobile",
              "build:android, build:android:preview, build:ios",
              "Creates EAS production or preview store binaries.",
            ],
            [
              "@supastack/mobile",
              "submit:android, submit:ios",
              "Submits the configured production binary to the matching app store.",
            ],
            [
              "@supastack/desktop",
              "dev, build, test, typecheck, tauri",
              "Runs Tauri, creates the desktop bundle, and checks the Rust shell.",
            ],
            [
              "@supastack/desktop",
              "icons",
              "Regenerates desktop platform icons from the blank placeholder; replace it with your product icon.",
            ],
            [
              "@supastack/docs",
              "dev, build, start, test, typecheck",
              "Runs the standalone setup-guide app and its checks.",
            ],
            [
              "Shared @supastack/* packages",
              "build, test, typecheck",
              "Compile declarations and run each package's deterministic tests.",
            ],
            [
              "@supastack/db",
              "db:generate, db:migrate",
              "Generate Drizzle migrations or apply checked-in migrations to DATABASE_URL.",
            ],
          ],
        },
      },
      {
        id: "safe-acceptance",
        title: "Choose the right acceptance command",
        paragraphs: [
          "Use `pnpm check:local` for fast local code acceptance without the Rust toolchain. Use `pnpm verify:local` when you also need production compilation and browser journeys. A green local run does not authenticate real users, send real email, or prove provider callbacks; test those integrations in their sandbox using the deployment guide.",
          "Choose commands for the platform you are building. The local guide is a safe starting point; production credentials and store publishing belong to the later deployment and distribution steps.",
        ],
      },
    ],
  ),
  guide(
    "reference/packages",
    "Packages and apps",
    "A source map for every workspace app and shared package shipped from this monorepo.",
    [
      {
        id: "apps",
        title: "Platform and documentation apps",
        paragraphs: [
          "The workspace contains web, mobile, desktop, and setup-documentation apps. Product UI, authentication, and chat logic live in the web app; the desktop executable is a Tauri shell over that web app, while mobile uses Expo and native platform APIs.",
        ],
        table: {
          head: ["Workspace", "Role", "Source path"],
          rows: [
            [
              "@supastack/web",
              "Next.js product, marketing, API, and web documentation application.",
              "apps/web/app · apps/web/src",
            ],
            [
              "@supastack/mobile",
              "Expo Router mobile application and native client integrations.",
              "apps/mobile/app · apps/mobile/src",
            ],
            [
              "@supastack/desktop",
              "Tauri webview shell, tray, hotkey, and single-instance behavior.",
              "apps/desktop/src-tauri/src · apps/desktop/package.json",
            ],
            [
              "@supastack/docs",
              "Standalone local setup guide application and guide content.",
              "apps/docs/app · apps/docs/src/setup-content.ts",
            ],
          ],
        },
      },
      {
        id: "server-packages",
        title: "Server and platform packages",
        paragraphs: [
          "Shared packages define narrow TypeScript boundaries so provider choices and product workflows stay separate. Each package exports from its `src/` tree; imports should use the package name rather than reaching into another package's private files.",
        ],
        table: {
          head: ["Workspace", "Role", "Source path"],
          rows: [
            [
              "@supastack/agents",
              "Agent execution adapters, shared workspace tools, and runner composition.",
              "packages/agents/src/index.ts",
            ],
            [
              "@supastack/ai",
              "Model contracts, provider adapters, routing, pricing, structured output, and key vault.",
              "packages/ai/src/index.ts",
            ],
            [
              "@supastack/api",
              "Versioned REST request and response schemas, errors, and OpenAPI document generation.",
              "packages/api/src/index.ts",
            ],
            [
              "@supastack/auth",
              "Better Auth configuration, server and Expo clients, OAuth provider setup, and auth handlers.",
              "packages/auth/src/index.ts · packages/auth/src/server.ts · packages/auth/src/expo.ts",
            ],
            [
              "@supastack/billing",
              "Common checkout, portal, and signed-webhook contract with provider adapters.",
              "packages/billing/src/index.ts",
            ],
            [
              "@supastack/config",
              "Validated server and public configuration derived from environment variables.",
              "packages/config/src/index.ts",
            ],
            [
              "@supastack/db",
              "Drizzle schema, Postgres connection, workspace-scoped repositories, and persistence adapters.",
              "packages/db/src/index.ts · packages/db/src/schema.ts",
            ],
            [
              "@supastack/email",
              "Transactional and outreach message contracts, transports, and React Email templates.",
              "packages/email/src/index.ts",
            ],
            [
              "@supastack/i18n",
              "Supported locale types, message dictionaries, and locale resolution helpers.",
              "packages/i18n/src/index.ts",
            ],
            [
              "@supastack/jobs",
              "JobRunner enqueue/status/cancel contract and local runner implementation.",
              "packages/jobs/src/index.ts",
            ],
            [
              "@supastack/observability",
              "Structured logs, redaction, analytics and error clients, metrics, and correlation helpers.",
              "packages/observability/src/index.ts",
            ],
            [
              "@supastack/storage",
              "Workspace-keyed object storage interface and memory/S3-compatible adapters.",
              "packages/storage/src/index.ts",
            ],
          ],
        },
      },
      {
        id: "ui-and-design-packages",
        title: "UI and design packages",
        paragraphs: [
          "Web and native UI packages stay separate because browser and React Native controls have different platform contracts. The token package is the shared design vocabulary; the web app's theme catalogs build the broader visitor-selectable styles and layouts on top.",
        ],
        table: {
          head: ["Workspace", "Role", "Source path"],
          rows: [
            [
              "@supastack/design-tokens",
              "Shared reference color, type, radius, shadow, and spacing tokens.",
              "packages/design-tokens/src/index.ts",
            ],
            [
              "@supastack/ui-native",
              "Copyable native entitlement card primitive for Expo screens.",
              "packages/ui-native/src/entitlement-card.ts",
            ],
            [
              "@supastack/ui-web",
              "Web navigation references and class-name utility for app-shell composition.",
              "packages/ui-web/src/index.ts",
            ],
          ],
        },
      },
      {
        id: "composition-boundaries",
        title: "How the workspaces fit together",
        paragraphs: [
          "The web app composes the shared packages and owns server-side composition roots under `apps/web/src/*-runtime.ts`. It connects configured providers, authentication, database repositories, and route handlers. Mobile calls the web API and uses `@supastack/ui-native`; desktop loads the configured web app instead of copying its product screens.",
          "Start from the package boundary that owns the behavior. Add a new billing provider in `packages/billing`; provider selection and secrets belong in `packages/config`; database shape belongs in `packages/db`; product routes and app-specific composition belong in `apps/web`. Keep user-owned records scoped by workspaceId at the server boundary.",
        ],
        links: [
          {
            href: "/docs/web/project-structure",
            label: "Project structure",
            description: "See the repository's source layout.",
          },
          {
            href: "/docs/reference/guides",
            label: "Guide directory",
            description: "Browse documentation by topic.",
          },
        ],
      },
    ],
  ),
  guide(
    "reference/api-routes",
    "API route reference",
    "Every Next.js route handler under apps/web/app/api, its implemented HTTP methods, caller authentication, and responsibility.",
    [
      {
        id: "access-classes",
        title: "Read the access labels",
        paragraphs: [
          "Session means a Better Auth or Auth.js user session; workspace membership, role, ownership, and record ownership checks still apply inside each handler. Bearer API key means a scoped sk_ key. Versioned REST accepts either the documented session or API key path, while /api/mcp accepts API keys only.",
          "Public means the handler intentionally has no user-session requirement. Provider signature means the billing receiver verifies the named provider's signed request. Internal secret marks the scheduler tick header. Development only means the route returns 404 in production. The method column shows exported handlers; methods not listed use Next.js's normal method-not-allowed behavior.",
        ],
        table: {
          head: ["Access label", "Meaning"],
          rows: [
            [
              "Session",
              "Requires a signed-in account; workspace and action permissions are checked by the handler.",
            ],
            [
              "Session; owner/admin",
              "Requires the owner or admin role for the workspace resource; handlers may allow reads, mutations, or both.",
            ],
            [
              "Session; workspace manager",
              "Requires an owner or admin role in the active workspace before starting or completing account connections.",
            ],
            [
              "Bearer API key",
              "Requires a valid API key and the scope needed by the requested tool or REST operation.",
            ],
            [
              "Provider signature",
              "Authenticates the incoming billing event with the provider-specific signature headers and secret.",
            ],
            [
              "Provider authorization",
              "Requires an exact configured Authorization header from the purchase provider.",
            ],
            [
              "Internal secret",
              "Requires the configured SCHEDULER_TICK_SECRET in the x-scheduler-key header.",
            ],
            [
              "Public",
              "No user session is required; the handler may still validate data or apply rate limits.",
            ],
            ["Development only", "Local reference helper; unavailable in production."],
          ],
        },
      },
      {
        id: "identity-and-billing-routes",
        title: "Identity, accounts, tasks, and billing routes",
        paragraphs: [
          "Connected-account OAuth uses workspace-manager authorization and state-cookie validation. Billing checkout and portal requests pass through the active provider adapter; webhook receivers verify their own signature format before changing the entitlement ledger.",
        ],
        table: {
          head: ["Method", "Route", "Access", "Purpose"],
          rows: [
            [
              "GET/PUT",
              "/api/account/appearance",
              "Session",
              "Reads or updates the signed-in user's synced appearance bundle across devices.",
            ],
            [
              "GET",
              "/api/account/export",
              "Session",
              "Exports the signed-in user's data and records the export audit event.",
            ],
            [
              "GET",
              "/api/accounts/[provider]/connect",
              "Session; workspace manager",
              "Starts a connected-account OAuth flow and writes a state cookie.",
            ],
            [
              "GET",
              "/api/accounts/[provider]/callback",
              "Session; workspace manager",
              "Validates the OAuth return and saves the connected workspace account.",
            ],
            [
              "POST",
              "/api/admin/credits",
              "Platform admin",
              "Grants prepaid credits to a workspace and writes the admin audit event.",
            ],
            [
              "GET/POST",
              "/api/auth/[...all]",
              "Public auth flow",
              "Serves Better Auth or Auth.js sign-in, callback, session, and credential endpoints with rate limits.",
            ],
            ["POST", "/api/ai/tasks", "Session", "Validates and enqueues a production AI task."],
            [
              "GET",
              "/api/ai/tasks/[taskId]",
              "Session",
              "Returns status for a task owned by the caller's workspace.",
            ],
            [
              "GET",
              "/api/announcements",
              "Public",
              "Lists currently active platform announcements.",
            ],
            [
              "POST",
              "/api/analytics/collect",
              "Public",
              "Records a consent-gated analytics event when the local analytics provider is enabled; no raw IP is stored.",
            ],
            [
              "POST",
              "/api/billing/checkout",
              "Session",
              "Creates a checkout session through the configured billing provider.",
            ],
            [
              "POST",
              "/api/billing/portal",
              "Session",
              "Creates a customer billing-portal session through the configured provider.",
            ],
            [
              "POST",
              "/api/billing/webhook",
              "Provider signature",
              "Verifies signed provider events and updates shared billing entitlements.",
            ],
            [
              "POST",
              "/api/billing/webhook/creem",
              "Provider signature",
              "Verifies signed provider events and updates shared billing entitlements.",
            ],
            [
              "POST",
              "/api/billing/webhook/dodo",
              "Provider signature",
              "Verifies signed provider events and updates shared billing entitlements.",
            ],
            [
              "POST",
              "/api/billing/webhook/lemonsqueezy",
              "Provider signature",
              "Verifies signed provider events and updates shared billing entitlements.",
            ],
            [
              "POST",
              "/api/billing/webhook/paddle",
              "Provider signature",
              "Verifies signed provider events and updates shared billing entitlements.",
            ],
            [
              "POST",
              "/api/billing/webhook/paypal",
              "Provider signature",
              "Verifies signed provider events and updates shared billing entitlements.",
            ],
            [
              "POST",
              "/api/billing/webhook/polar",
              "Provider signature",
              "Verifies signed provider events and updates shared billing entitlements.",
            ],
            [
              "POST",
              "/api/billing/webhook/revenuecat",
              "Provider authorization",
              "Authenticates the configured Authorization header and re-fetches current subscriber state before updating entitlements.",
            ],
            [
              "POST",
              "/api/billing/webhook/whop",
              "Provider signature",
              "Verifies signed provider events and updates shared billing entitlements.",
            ],
          ],
        },
      },
      {
        id: "chat-and-operations-routes",
        title: "Chat, reference, and operations routes",
        paragraphs: [
          "Chat routes resolve the caller's active workspace before listing, changing, or streaming a thread. The API reference and health probe are public read surfaces. The scheduler endpoint is intentionally disabled until its internal secret is set; local reference actions are restricted to non-production environments.",
        ],
        table: {
          head: ["Method", "Route", "Access", "Purpose"],
          rows: [
            [
              "POST",
              "/api/chat/stream",
              "Session",
              "Streams an AI response for a workspace chat request.",
            ],
            [
              "GET/POST",
              "/api/chat/threads",
              "Session",
              "Lists workspace chat threads or creates a new thread.",
            ],
            [
              "GET/PATCH/DELETE",
              "/api/chat/threads/[threadId]",
              "Session",
              "Reads, renames, or deletes a thread after workspace ownership checks.",
            ],
            [
              "POST",
              "/api/chat/threads/[threadId]/messages",
              "Session",
              "Appends a user message and starts its assistant response.",
            ],
            [
              "GET",
              "/api/docs",
              "Public",
              "Renders the Scalar API reference backed by the OpenAPI JSON route.",
            ],
            [
              "GET",
              "/api/health",
              "Public",
              "Reports dependency health and provider configuration without exposing secrets.",
            ],
            [
              "POST",
              "/api/internal/scheduler-tick",
              "Internal secret",
              "Claims due workspace schedules and dispatches their registered jobs.",
            ],
            [
              "GET/POST",
              "/api/local-reference/[action]",
              "Development only",
              "Runs the local golden-path login, task, status, and result helper actions.",
            ],
            [
              "POST/GET/DELETE",
              "/api/mcp",
              "Bearer API key",
              "POST serves stateless Streamable HTTP MCP tools; GET and DELETE return 405.",
            ],
          ],
        },
      },
      {
        id: "mobile-workspace-routes",
        title: "Mobile workspace and administration routes",
        paragraphs: [
          "These JSON BFF routes use the signed-in mobile session and resolve the active workspace on the server. Owner/admin checks apply to API-key, audit, commerce, domain, invitation, member, schedule, and webhook administration; workspace writers manage CMS content and can submit feedback and vote.",
        ],
        table: {
          head: ["Method", "Route", "Access", "Purpose"],
          rows: [
            [
              "GET/PUT",
              "/api/mobile/appearance",
              "Session",
              "Reads or updates the signed-in user's synced appearance bundle for the mobile client.",
            ],
            [
              "GET/POST",
              "/api/mobile/api-keys",
              "Session; owner/admin",
              "Lists workspace API-key metadata or creates a key whose secret is returned once.",
            ],
            [
              "DELETE",
              "/api/mobile/api-keys/[keyId]",
              "Session; owner/admin",
              "Revokes a workspace API key.",
            ],
            [
              "GET",
              "/api/mobile/audit",
              "Session; owner/admin",
              "Lists recent audit events for the active workspace.",
            ],
            [
              "GET/POST",
              "/api/mobile/commerce/products",
              "Session; owner/admin",
              "Lists workspace products or creates a draft (price is a decimal amount normalized to cents).",
            ],
            [
              "PATCH",
              "/api/mobile/commerce/products/[productId]",
              "Session; owner/admin",
              "Updates product fields and/or moves the product between draft, active, and archived.",
            ],
            [
              "GET",
              "/api/mobile/commerce/orders",
              "Session; owner/admin",
              "Lists workspace orders with their line items.",
            ],
            [
              "PATCH",
              "/api/mobile/commerce/orders/[orderId]",
              "Session; owner/admin",
              "Advances an order along the forward-only lifecycle (pending → paid → fulfilled, with cancel/refund branches).",
            ],
            [
              "GET/POST",
              "/api/mobile/content",
              "Session; member+",
              "Lists workspace CMS entries or creates a draft entry.",
            ],
            [
              "GET/PATCH/DELETE",
              "/api/mobile/content/[entryId]",
              "Session; member+",
              "Reads one entry with its body, updates entry fields and/or moves it between draft, published, and archived, or deletes it.",
            ],
            [
              "GET",
              "/api/mobile/credits",
              "Session",
              "Returns the active workspace prepaid credit balance for the mobile client.",
            ],
            [
              "GET/POST",
              "/api/mobile/domains",
              "Session; owner/admin",
              "Lists workspace custom domains or adds a hostname.",
            ],
            [
              "DELETE",
              "/api/mobile/domains/[domainId]",
              "Session; owner/admin",
              "Removes a custom hostname from the active workspace.",
            ],
            [
              "POST",
              "/api/mobile/domains/[domainId]/refresh",
              "Session; owner/admin",
              "Refreshes the provider state of a workspace custom hostname.",
            ],
            [
              "GET",
              "/api/mobile/entitlement",
              "Session",
              "Returns the current workspace entitlement state for the mobile client.",
            ],
            [
              "GET/POST",
              "/api/mobile/purchases/sync",
              "Session; owner/admin",
              "Reports purchase availability and workspace identity or refreshes the server-verified workspace entitlement.",
            ],
            [
              "GET/POST/DELETE",
              "/api/mobile/push-tokens",
              "Session",
              "Lists, registers, or revokes Expo push tokens for the signed-in mobile installation.",
            ],
            [
              "GET/POST",
              "/api/mobile/feature-requests",
              "Session",
              "Lists the workspace feature board or creates a normalized request as a member.",
            ],
            [
              "POST",
              "/api/mobile/feature-requests/[requestId]/vote",
              "Session",
              "Toggles the signed-in member's vote on a workspace request.",
            ],
            [
              "POST",
              "/api/mobile/invitations",
              "Session; owner/admin",
              "Creates and emails an invitation to join the active organization.",
            ],
            [
              "POST",
              "/api/mobile/invitations/accept",
              "Session",
              "Accepts an invitation token for the signed-in user and selects the joined workspace.",
            ],
            [
              "DELETE",
              "/api/mobile/invitations/[invitationId]",
              "Session; owner/admin",
              "Revokes a pending workspace invitation.",
            ],
            [
              "POST",
              "/api/mobile/invitations/[invitationId]/resend",
              "Session; owner/admin",
              "Resends an eligible pending workspace invitation.",
            ],
            [
              "PATCH/DELETE",
              "/api/mobile/members/[userId]",
              "Session; owner/admin",
              "Changes a member role or removes a member from the organization.",
            ],
            [
              "POST",
              "/api/mobile/members/leave",
              "Session",
              "Leaves the active organization when ownership rules allow it.",
            ],
            [
              "GET/POST/PATCH/DELETE",
              "/api/mobile/organization",
              "Session; owner for rename/delete",
              "Lists organization members and invitations, creates a workspace, renames the organization, or deletes it after name confirmation.",
            ],
            [
              "GET/POST",
              "/api/mobile/schedules",
              "Session; owner/admin",
              "Lists recurring workspace schedules or creates and updates a schedule.",
            ],
            [
              "DELETE",
              "/api/mobile/schedules/[scheduleId]",
              "Session; owner/admin",
              "Removes a recurring schedule from the active workspace.",
            ],
            [
              "GET",
              "/api/mobile/usage",
              "Session",
              "Returns the active workspace's current-month AI spend, meter caps, and prepaid credit balance.",
            ],
            [
              "GET/POST",
              "/api/mobile/webhooks",
              "Session; owner/admin",
              "Lists webhook endpoints or creates one with a signing secret shown once.",
            ],
            [
              "DELETE",
              "/api/mobile/webhooks/[endpointId]",
              "Session; owner/admin",
              "Deletes a workspace webhook endpoint.",
            ],
            [
              "GET",
              "/api/mobile/webhooks/[endpointId]/deliveries",
              "Session; owner/admin",
              "Lists recent delivery attempts for a workspace webhook endpoint.",
            ],
            [
              "POST",
              "/api/mobile/webhooks/[endpointId]/ping",
              "Session; owner/admin",
              "Sends a test ping to a configured workspace webhook endpoint.",
            ],
          ],
        },
      },
      {
        id: "web-settings-and-storage-routes",
        title: "Notifications, onboarding, files, and workspace routes",
        paragraphs: [
          "The browser and mobile clients use these session-authenticated handlers for personal settings and workspace-owned resources. Uploaded and retrieved objects are checked against the active workspace; organization logos reuse the logo upload handler.",
        ],
        table: {
          head: ["Method", "Route", "Access", "Purpose"],
          rows: [
            [
              "GET/PATCH",
              "/api/notifications",
              "Session",
              "Lists notifications or updates notification delivery preferences.",
            ],
            [
              "POST",
              "/api/onboarding/organization",
              "Session",
              "Creates the initial organization and membership records during onboarding.",
            ],
            [
              "GET/POST",
              "/api/onboarding/state",
              "Session",
              "Reads or updates the signed-in user's onboarding state.",
            ],
            ["POST", "/api/storage/avatar", "Session", "Uploads a user's avatar image."],
            [
              "POST",
              "/api/storage/logo",
              "Session; owner/admin",
              "Uploads the active workspace logo.",
            ],
            [
              "POST",
              "/api/storage/organization-logo",
              "Session; owner/admin",
              "Alias of the workspace logo upload handler.",
            ],
            [
              "GET",
              "/api/storage/objects",
              "Session",
              "Reads an object after checking workspace membership and object-key scope.",
            ],
            [
              "GET",
              "/api/workspace/credits",
              "Session",
              "Returns the prepaid credit balance and recent credit ledger entries for the active workspace.",
            ],
            [
              "GET",
              "/api/workspace/export",
              "Session; owner/admin",
              "Downloads a JSON export of the active workspace's content, members, and settings.",
            ],
            [
              "GET",
              "/api/workspace/metrics",
              "Session",
              "Returns usage and activity metrics for the active workspace.",
            ],
            [
              "GET/POST",
              "/api/workspaces",
              "Session",
              "Lists available workspaces or switches the active workspace.",
            ],
          ],
        },
      },
      {
        id: "versioned-api-routes",
        title: "Versioned REST API routes",
        paragraphs: [
          "The /api/v1 REST surface shares one rate limiter and accepts either an authenticated app session or a scoped Bearer sk_ API key. API-key callers are bound to the key's workspace; the server never accepts a client-selected workspace as proof of access. The OpenAPI document is public so clients can inspect the contract before authenticating.",
        ],
        table: {
          head: ["Method", "Route", "Access", "Purpose"],
          rows: [
            [
              "POST",
              "/api/v1/ai-tasks",
              "Session or Bearer API key",
              "Creates an entitlement-gated AI task with idempotency support.",
            ],
            [
              "GET",
              "/api/v1/ai-tasks/[taskId]",
              "Session or Bearer API key",
              "Returns task status only when the caller owns its workspace.",
            ],
            [
              "GET",
              "/api/v1/ai-tasks/[taskId]/result",
              "Session or Bearer API key",
              "Returns a completed task result for its owning workspace.",
            ],
            [
              "GET",
              "/api/v1/entitlements",
              "Session or Bearer API key",
              "Lists entitlement state for the caller's active or key-bound workspace.",
            ],
            [
              "GET",
              "/api/v1/models/requirements",
              "Session or Bearer API key",
              "Lists model capability requirements supported by the configured catalog.",
            ],
            [
              "GET",
              "/api/v1/openapi",
              "Public",
              "Returns the generated OpenAPI document for the versioned REST surface.",
            ],
            [
              "GET",
              "/api/v1/workspaces/current",
              "Session or Bearer API key",
              "Returns the current workspace resolved from the session or key.",
            ],
          ],
        },
        links: [
          {
            href: "/api-reference",
            label: "Browse the API reference",
            description: "Endpoint list rendered from the published OpenAPI document.",
          },
        ],
      },
      {
        id: "analytics-routes",
        title: "Analytics ingest and product routes",
        paragraphs: [
          "The public tracking script posts events to /api/e with a site id and an optional sd_ ingest key; hostname allowlists and bot filtering apply before any write. The /api/v1 analytics surface accepts a Bearer sk_ workspace key, a Bearer sd_ site key pinned to one site, or an authenticated app session; sd_ keys can only ever see their own site.",
        ],
        table: {
          head: ["Method", "Route", "Access", "Purpose"],
          rows: [
            [
              "POST/OPTIONS",
              "/api/e",
              "Public site id",
              "Ingests pageview, goal, custom, and identify events from the tracking script.",
            ],
            [
              "POST/OPTIONS",
              "/api/v1/collect",
              "Public site id",
              "Alias of /api/e on the versioned path for tracked events.",
            ],
            [
              "GET/POST",
              "/api/v1/alerts",
              "Session, Bearer sk_ key, or sd_ site key",
              "Lists alert rules for a site or creates one.",
            ],
            [
              "GET",
              "/api/v1/analytics/[dimension]",
              "Session, Bearer sk_ key, or sd_ site key",
              "Breaks events down by page, channel, source, or visitor attributes, with attributed revenue.",
            ],
            [
              "GET",
              "/api/v1/analytics/funnel-results",
              "Session, Bearer sk_ key, or sd_ site key",
              "Computes step counts and conversion for a funnel over a range.",
            ],
            [
              "GET",
              "/api/v1/analytics/insights",
              "Session, Bearer sk_ key, or sd_ site key",
              "Returns MRR and revenue-attribution insight series.",
            ],
            [
              "GET",
              "/api/v1/analytics/overview",
              "Session, Bearer sk_ key, or sd_ site key",
              "Returns headline KPIs with period-over-period deltas.",
            ],
            [
              "GET",
              "/api/v1/analytics/realtime",
              "Session, Bearer sk_ key, or sd_ site key",
              "Returns visitors active in the last few minutes.",
            ],
            [
              "GET",
              "/api/v1/analytics/timeseries",
              "Session, Bearer sk_ key, or sd_ site key",
              "Returns a bucketed metric series for a date range.",
            ],
            [
              "GET/POST",
              "/api/v1/funnels",
              "Session, Bearer sk_ key, or sd_ site key",
              "Lists funnels or creates one from an ordered step list.",
            ],
            [
              "GET/POST",
              "/api/v1/goals",
              "Session, Bearer sk_ key, or sd_ site key",
              "Lists goals or creates one.",
            ],
            [
              "POST",
              "/api/v1/identify",
              "Session, Bearer sk_ key, or sd_ site key",
              "Attaches an email or external id and traits to a tracked visitor.",
            ],
            [
              "GET/POST",
              "/api/v1/integrations",
              "Session, Bearer sk_ key, or sd_ site key",
              "Lists connected integrations or records one.",
            ],
            [
              "GET",
              "/api/v1/keywords",
              "Session, Bearer sk_ key, or sd_ site key",
              "Lists search keywords recorded for the site.",
            ],
            [
              "GET/POST",
              "/api/v1/mentions",
              "Session, Bearer sk_ key, or sd_ site key",
              "Lists social mentions for the site domain or records one.",
            ],
            [
              "GET/POST",
              "/api/v1/payments",
              "Session, Bearer sk_ key, or sd_ site key",
              "Lists payments or records one with channel and campaign attribution computed at write time.",
            ],
            [
              "GET/POST",
              "/api/v1/sites",
              "Session or Bearer sk_ key",
              "Lists workspace sites or creates one with its tracking credentials.",
            ],
            [
              "GET",
              "/api/v1/visitors",
              "Session, Bearer sk_ key, or sd_ site key",
              "Lists visitors with pagination and search.",
            ],
            [
              "GET",
              "/api/v1/visitors/[id]",
              "Session, Bearer sk_ key, or sd_ site key",
              "Returns a visitor profile, payments, and the chronological event journey.",
            ],
            [
              "POST",
              "/api/v1/webhooks/[provider]",
              "Session, Bearer sk_ key, or sd_ site key",
              "Normalizes a billing-provider webhook into an attributed payment.",
            ],
          ],
        },
      },
    ],
  ),
];

export function buildDirectoryGuide(entries: readonly Guide[]): Guide {
  const sections = groupGuides(entries).map((group) => ({
    id: group.id,
    title: group.title,
    paragraphs: [group.description],
    links: group.guides.map((entry) => ({
      href: `/docs/${entry.slug}`,
      label: entry.title,
      description: entry.description,
    })),
  }));

  return guide(
    "reference/guides",
    "Guide directory",
    "Browse every guide by the topic and task it supports.",
    sections,
  );
}
