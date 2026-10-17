import { additionalGuides } from "./additional-guides";
import { featureGuides } from "./feature-guides";
import { providerGuides } from "./provider-guides";
import { blockGuides } from "./block-guides";
import { buildDirectoryGuide, referenceGuides } from "./reference-guides";
import { buildDocsIndex } from "./docs-markdown";
import { organizeGuides, rankDocs } from "./docs-navigation";
import { withGuideContinuations } from "./docs-continuation";
import { beginnerGuides, withBeginnerInstructions } from "./beginner-guides";
export type SectionTable = {
  /** Column headings — an empty first cell marks a row-label column. */
  head: readonly string[];
  /** Body rows; each must match `head.length` cells. */
  rows: readonly (readonly string[])[];
  /** Column index rendered with accent styling (e.g. the product column). */
  accentColumn?: number;
};
export type Section = {
  id: string;
  title: string;
  paragraphs: readonly string[];
  code?: string;
  items?: readonly string[];
  table?: SectionTable;
  links?: readonly { href: string; label: string; description?: string }[];
};
export type Post = {
  slug: string;
  title: string;
  description: string;
  category: string;
  date: string;
  guide: string;
  art: "foundation" | "boundary" | "pipeline";
  sections: readonly Section[];
};
export type Guide = {
  slug: string;
  tab: "web" | "mobile" | "desktop" | "modules";
  group: string;
  title: string;
  description: string;
  sections: readonly Section[];
  continueTo?: string;
  setupFlowTo?: string;
};
export const docTabs = [
  { slug: "web", label: "Web", detail: "Next.js" },
  { slug: "mobile", label: "Mobile", detail: "Expo" },
  { slug: "desktop", label: "Desktop", detail: "Tauri" },
  { slug: "modules", label: "Modules", detail: "Shared foundation" },
] as const;
export const posts: readonly Post[] = [
  {
    slug: "a-foundation-for-your-next-product",
    title: "A foundation you can build on.",
    description:
      "The thinking behind supastack: shared infrastructure, clear boundaries, and room for your product to be its own thing.",
    category: "Architecture",
    date: "2026-09-11",
    guide: "web",
    art: "foundation",
    sections: [
      {
        id: "the-repeated-work",
        title: "The work every product repeats",
        paragraphs: [
          "A new product starts with a particular problem. Its first weeks often look much less particular: sessions, workspace records, subscription state, background work, and email delivery. These pieces need to cooperate before the product can do anything useful.",
          "supastack gives that repeated work a home. A Next.js web app and an Expo mobile app share TypeScript packages for the infrastructure underneath. The aim is to make those boundaries understandable enough that a product can configure them without inheriting somebody else’s domain model.",
        ],
      },
      {
        id: "one-responsibility",
        title: "Give each module one responsibility",
        paragraphs: [
          "Identity establishes who is making a request. Workspaces determine which records that person can access. Billing records payment state, while entitlements answer whether a capability is available. Keeping these concerns distinct prevents a successful payment redirect from becoming an authorization decision.",
          "The same discipline applies to background work. The shared JobRunner contract promises enqueue, status, and cancel. Trigger.dev owns the workflow behavior. A small interface is valuable when its limits are visible; hiding retries or scheduling behind a generic method would make the system harder to reason about.",
        ],
      },
      {
        id: "product-boundary",
        title: "Leave room for the product",
        paragraphs: [
          "A prospecting workflow, a document editor, and a research assistant may use the same identity and billing modules. Their records, language, and workflows are still different. Product-specific logic belongs in the consuming product codebase, with configuration connecting it to the foundation.",
          "This separation is also a practical maintenance decision. A fix to workspace isolation should be reusable. A change to how one product scores a prospect should not become a new requirement for every other product.",
        ],
        table: {
          head: ["", "The foundation owns", "Your product owns"],
          accentColumn: 1,
          rows: [
            ["Identity", "Sessions, providers, verification", "Sign-in experience, profile fields"],
            ["Billing", "Checkout, entitlements, portals", "Plans, pricing, upgrade prompts"],
            ["Background work", "Enqueue, status, cancel contract", "Task payloads and outcomes"],
            ["Delivery", "Transactional senders, templates", "Copy, branding, cadence"],
          ],
        },
      },
      {
        id: "start-small",
        title: "Start with one complete flow",
        paragraphs: [
          "Begin with the local reference flow: sign in, inspect access, submit a task, and read its result. Fake and local adapters let deterministic tests exercise the path without paid provider requests. Then configure the production integrations your product actually needs.",
          "Local acceptance and production acceptance answer different questions. A passing local test establishes application behavior under controlled conditions. Real authentication persistence, provider delivery, deployment, and device behavior still need their own verification. Keep that distinction visible as the product grows.",
        ],
      },
    ],
  },
  {
    slug: "workspace-boundaries",
    title: "Your workspace is a security boundary.",
    description:
      "Why ownership checks belong in every read and write, and why a task URL should never grant access.",
    category: "Engineering",
    date: "2026-09-10",
    guide: "modules/workspaces",
    art: "boundary",
    sections: [
      {
        id: "derive-ownership",
        title: "Derive ownership on the server",
        paragraphs: [
          "A record ID identifies something; it does not prove who may read it. supastack scopes user-owned records by workspaceId. The server resolves the authenticated user’s workspace and includes that scope when reading or changing a record.",
          "Do not treat a workspace ID sent by the browser as evidence of ownership. The browser can request an action, but the trusted server context must establish whose action it is. This rule needs to hold for task status, saved provider configuration, usage records, and every product-owned resource.",
        ],
      },
      {
        id: "recovery-links",
        title: "Make recovery useful without granting access",
        paragraphs: [
          "A task URL lets a user return after a refresh. It is useful precisely because it preserves a reference to the work. The authenticated API must still verify that the requested task belongs to the current workspace before returning status or results.",
          "The same principle applies to submission recovery. An idempotency key helps identify a repeated request and prevent duplicate work. It is neither a session nor an access token. Retrying a saved submission still requires authentication, workspace ownership, and the appropriate entitlement.",
        ],
      },
      {
        id: "test-the-negative",
        title: "Test the requests that must fail",
        paragraphs: [
          "A test that lets an owner retrieve a record proves the happy path. It does not prove isolation. Pair it with a second workspace requesting the same record, an anonymous request, and a write that attempts to substitute another owner.",
          "Assert the external behavior as well as the persisted result. A rejected request must not mutate another workspace’s data, and an error response must not leak secrets or raw database details. These checks make the boundary reviewable when implementation changes.",
        ],
      },
      {
        id: "apply-consistently",
        title: "Carry the rule into your product",
        paragraphs: [
          "When you add a new product table, decide its ownership before building the screen. Include workspaceId in its persistence model, resolve the workspace through the existing server boundary, and use that context in both list and detail operations.",
          "Background workers need the same care. A queued task must carry enough trusted context to load the correct record, while provider credentials stay on the server. A consistent ownership rule is easier to maintain than a collection of route-specific exceptions.",
        ],
      },
    ],
  },
  {
    slug: "from-ai-request-to-result",
    title: "An AI request is only the beginning.",
    description:
      "Follow a task through authorization, durable execution, usage tracking, and a result the user can return to.",
    category: "Guides",
    date: "2026-09-08",
    guide: "modules/ai",
    art: "pipeline",
    sections: [
      {
        id: "before-generation",
        title: "Before the model runs",
        paragraphs: [
          "The user supplies a prompt and an alias such as cheap, fast, or smart. The production server checks authentication, workspace ownership, and entitlement before accepting the task. Provider model IDs and secrets remain behind that boundary.",
          "A durable task record gives the request an identity before the background execution begins. That identity connects the submission, the worker, usage records, and the result. It also gives the user a way to recover the work after navigating away.",
        ],
      },
      {
        id: "durable-execution",
        title: "Make execution explicit",
        paragraphs: [
          "Trigger.dev runs the ai.generate workflow. The capability-aware router selects a model using configured policy and the request’s requirements. Treat that policy as an operational input: an unavailable alias should not appear as a working choice in the interface.",
          "A network failure during submission can leave the client uncertain about whether work was queued. The production path uses a task-scoped idempotency key and a saved submission so recovery can reuse the original request. Sending a new task after every timeout would risk duplicate work and duplicate cost.",
        ],
      },
      {
        id: "after-generation",
        title: "Track what happened",
        paragraphs: [
          "Generation produces more than text. The application records usage and a task result, and the interface reads status through the authenticated API. Budget enforcement and usage accounting belong in the server workflow, not in a browser estimate.",
          "Completion email is a separate step with separate delivery records. A successful model response does not establish that an email was delivered. Keeping those outcomes distinct makes failures easier to explain and retry without rerunning the model unnecessarily.",
        ],
      },
      {
        id: "verify-the-path",
        title: "Verify each boundary",
        paragraphs: [
          "Use deterministic fake adapters to test the application’s decisions first: denied access, disabled aliases, duplicate submissions, result recovery, and generic errors. Those tests should run without provider credentials.",
          "Then use the explicitly opted-in provider smoke process for real integrations. It requires the documented sandbox configuration and approval to make external calls. The distinction keeps ordinary development fast while making production evidence specific and accountable.",
        ],
      },
    ],
  },
];

const baseGuides: readonly Guide[] = [
  {
    slug: "web",
    tab: "web",
    group: "Getting started",
    title: "Introduction",
    description: "Get to know the foundation, then make it yours.",
    sections: [
      {
        id: "overview",
        title: "Build from a shared foundation",
        paragraphs: [
          "supastack is a modular foundation for AI SaaS on web, mobile and desktop. Next.js carries the web UI and API, Expo provides native reference flows, and the Tauri desktop shell loads the same web app. Shared packages handle identity, workspaces, billing, AI, jobs, email, storage and observability.",
          "Start with the local reference flow to understand how the modules fit together. Configure production providers only after that flow works in your environment.",
        ],
      },
      {
        id: "structure",
        title: "Find your way around",
        paragraphs: [
          "Applications compose the shared packages. Product-specific features belong in the consuming product codebase rather than in the reusable core.",
        ],
        code: "apps/\n  web/       Next.js interface and API routes\n  mobile/    Expo application\npackages/\n  auth/      Identity and sessions\n  db/        Schema and workspace persistence\n  billing/   Billing and entitlements\n  ai/        Providers, routing, and usage\n  jobs/      Background job contract\n  email/     Transactional delivery",
      },
      {
        id: "choose-path",
        title: "Choose your starting point",
        paragraphs: [
          "Start with the five-minute local setup. Then follow the Continue setup link at the bottom of each guide: configure the database, authentication, plans and providers before preparing deployment. Use the complete documentation index to find every feature, provider, component and reference.",
          "The local golden path has passed in the project’s development environment. Timed clean-clone setup, real-provider smoke, deployment, and physical-device acceptance remain separate verification steps.",
        ],
        links: [
          { href: "/docs/web/local-setup", label: "Set up locally in five minutes" },
          { href: "/docs/reference/guides", label: "Browse all documentation" },
          { href: "/docs/mobile", label: "Mobile setup" },
          { href: "/docs/desktop", label: "Desktop setup" },
        ],
      },
    ],
  },
  {
    slug: "web/local-setup",
    tab: "web",
    group: "Getting started",
    title: "Set up in 5 minutes",
    description:
      "Install the workspace and start the credential-free local app. Then follow the guided path to configure your product and production services.",
    sections: [
      {
        id: "prerequisites",
        title: "Prerequisites",
        paragraphs: [
          "Aim to get the local app running in about five minutes after prerequisites and repository access are ready. Install Node.js 22 or newer with Corepack available. The repository pins pnpm 11.19.0. Dependency download time varies; real providers, database provisioning and deployment are later steps.",
          "Open a terminal in your own clone or fork of supastack. Keep the generated .env file local. This quickstart uses fake/local adapters and does not call paid providers.",
        ],
      },
      {
        id: "install",
        title: "Prepare the workspace",
        paragraphs: [
          "Copy the example environment file, then install the workspace dependencies. On Windows PowerShell, use Copy-Item .env.example .env for the first command. If .env already exists, review it instead of overwriting your configuration.",
        ],
        code: "# From the repository root (macOS / Linux):\ncp .env.example .env\ncorepack pnpm install\ncorepack pnpm dev",
      },
      {
        id: "windows",
        title: "Windows PowerShell setup",
        paragraphs: [
          "Corepack's shim must be on PATH because Turbo resolves pnpm by name. The commands below create it in a user-writable folder, so no elevated terminal or global pnpm install is needed. If .env already exists, keep it and review the example instead of copying over it.",
        ],
        code: '$docsShimDir = Join-Path $env:LOCALAPPDATA "supastack\\corepack-shims"\nNew-Item -ItemType Directory -Path $docsShimDir -Force | Out-Null\ncorepack enable --install-directory $docsShimDir\n$env:PATH = "$docsShimDir;$env:PATH"\nCopy-Item .env.example .env\ncorepack pnpm install\ncorepack pnpm dev',
      },
      {
        id: "open",
        title: "Explore the web app",
        paragraphs: [
          "Open http://localhost:3000. The homepage is at /, the local reference interface is at /ai, sign-in is at /auth and settings are at /settings. The separate workspace docs app starts at http://localhost:3001.",
          "The local reference mode demonstrates the UI and fake/local contracts. Real persisted accounts, teams, billing, CMS and integrations require migrated Postgres and their configured providers. Continue to Database and migrations to prepare that path.",
        ],
      },
      {
        id: "verify",
        title: "Verify after the app runs",
        paragraphs: [
          "Run the local acceptance gate when you are ready to validate lint, types, deterministic tests, builds and browser suites. It takes longer than the quickstart and needs no Rust toolchain. PR tests use fake/local providers; external-provider acceptance is a separate opt-in gate.",
        ],
        code: "corepack pnpm verify:local",
        links: [
          { href: "/docs/web/database", label: "Continue: configure Postgres and run migrations" },
          { href: "/docs/web/troubleshooting", label: "Resolve a setup error" },
        ],
      },
    ],
  },
  {
    slug: "web/configuration",
    tab: "web",
    group: "Development",
    title: "Configuration",
    description: "Keep application configuration explicit and provider credentials on the server.",
    sections: [
      {
        id: "environment",
        title: "Start with the environment example",
        paragraphs: [
          "The root .env.example is the configuration inventory. Shared validation lives in packages/config. Review the selected application environment and provider modes together; a local interface is not a production credential strategy.",
          "The credential-free reference mode requires local/test application configuration and fake/local providers. Selecting a production provider changes the runtime requirements.",
        ],
      },
      {
        id: "secrets",
        title: "Keep secrets behind the API",
        paragraphs: [
          "Authentication secrets, database credentials, provider keys, Stripe secrets, and Trigger credentials are server-only. Never prefix them with NEXT_PUBLIC_ or EXPO_PUBLIC_. Do not print them during setup or include them in error responses.",
          "The browser receives public configuration and allowed model aliases. Workspace ownership, entitlement decisions, budgets, and provider selection remain server-enforced.",
        ],
      },
      {
        id: "checks",
        title: "Check a change before using it",
        paragraphs: [
          "Validate configuration through the existing config package and run the relevant deterministic tests. Use the separately opted-in provider smoke path when you are ready to verify real integrations.",
        ],
        code: "pnpm test\npnpm check\npnpm build",
      },
    ],
  },
  {
    slug: "web/deployment",
    tab: "web",
    group: "Development",
    title: "Deployment checklist",
    description: "Prepare the production dependencies and verify the flow you intend to ship.",
    sections: [
      {
        id: "services",
        title: "Prepare the services",
        paragraphs: [
          "Create the Postgres database, apply the repository's migrations and enter your public app URL and authentication settings in the hosting dashboard. Choose one supported Web billing provider and one transactional email provider for the features you enable. Configure Trigger.dev when your product uses its background workflows; you do not need every integration to publish a basic app.",
          "Configure the immutable model/price catalog and workspace AI policy before accepting production AI tasks. An empty alias policy should leave those choices unavailable.",
        ],
      },
      {
        id: "build",
        title: "Build and deploy the web application",
        paragraphs: [
          "Run the Web commands below from the repository root and resolve any error before continuing. typecheck checks the types, test runs the Web tests, and build creates production files locally. Follow your selected hosting guide to upload and run them with its server-side environment settings. These commands do not deploy the app.",
        ],
        code: "corepack pnpm --filter @supastack/web typecheck\ncorepack pnpm --filter @supastack/web test\ncorepack pnpm --filter @supastack/web build",
      },
      {
        id: "acceptance",
        title: "Verify the deployed boundaries",
        paragraphs: [
          "Verify sign-in and persistence against the deployed database; test workspace isolation; confirm Stripe sandbox webhook processing and entitlement changes; and run a background task through result persistence and transactional delivery.",
          "Read docs/real-provider-smoke.md and docs/production-ai-runtime.md in the repository for the explicit provider acceptance process. A successful build or intercepted browser test does not establish these external outcomes.",
        ],
      },
    ],
  },
  {
    slug: "mobile",
    tab: "mobile",
    group: "Getting started",
    title: "Mobile overview",
    description: "An Expo surface connected to the same server-owned foundation.",
    sections: [
      {
        id: "architecture",
        title: "Share contracts, keep native presentation",
        paragraphs: [
          "Expo includes native sign-in and session handling, workspace and settings surfaces, chat controls, and RevenueCat purchase workflows. The Next.js API and shared server packages remain the source for shared data, authorization, and provider verification; native screens call them instead of embedding server credentials.",
          "The Expo application lives in apps/mobile. It consumes the shared foundation through an API rather than embedding server credentials. Native authentication, secure session storage, deep links, chat controls, and RevenueCat purchase presentation each have client modules.",
        ],
      },
      {
        id: "configuration",
        title: "Configure the API and app scheme",
        paragraphs: [
          "Set EXPO_PUBLIC_API_URL to an API origin reachable by your emulator or physical device. Localhost on a phone refers to that phone, so use the appropriate reachable development host. EXPO_PUBLIC_APP_SCHEME identifies the app’s deep-link scheme.",
          "Review apps/mobile/app.config.ts and the authentication configuration before testing callbacks. Public Expo values are bundled into the client and must contain no provider secrets.",
        ],
      },
      {
        id: "testing",
        title: "Verify on the target device",
        paragraphs: [
          "Run deterministic session-storage, deep-link, chat-cancellation, and entitlement tests first. Then verify sign-in return, session restoration, sign-out, and purchase sync in the intended EAS development build; Expo Go cannot validate real store purchases.",
          "Physical-device and provider acceptance are separate from the local web golden path. Track them explicitly for each release target.",
        ],
      },
    ],
  },
  {
    slug: "mobile/entitlements",
    tab: "mobile",
    group: "Core concepts",
    title: "Mobile entitlements",
    description:
      "Present workspace access from server-verified RevenueCat entitlements without exposing web checkout.",
    sections: [
      {
        id: "read-access",
        title: "Read access from the server",
        paragraphs: [
          "The mobile entitlement client reads server-owned access state. Keep a loading or failed request distinct from an active subscription; the interface must not infer paid access because a request failed.",
          "Use the presentation logic in apps/mobile/src/entitlements to translate that state into the native interface.",
        ],
      },
      {
        id: "purchase-boundary",
        title: "Keep the purchase boundary explicit",
        paragraphs: [
          "Native purchases use RevenueCat when configured; web billing is a separate surface. Do not expose Stripe Checkout in the mobile interface or treat a store-side active flag as proof of server access.",
          "The In-app purchases guide documents client keys, manager checks, workspace identity, purchase/restore sync, server verification, and sandbox setup. Real StoreKit or Play Billing acceptance requires an EAS development build; Submit to the app stores covers release.",
        ],
      },
      {
        id: "verification",
        title: "Check denied and expired access",
        paragraphs: [
          "Test unavailable, inactive, and active entitlement states, plus network failures. Verify that restricted actions remain unavailable when the server denies access, and that signing out clears the previous session’s presentation.",
        ],
      },
    ],
  },
  {
    slug: "mobile/store-submission",
    tab: "mobile",
    group: "Distribution",
    title: "Submit to the app stores",
    description:
      "Take the Expo app from a working build to Google Play and App Store listings with EAS Build and Submit.",
    sections: [
      {
        id: "accounts",
        title: "Set up the accounts once",
        paragraphs: [
          "Store submission needs three accounts: a free Expo account for EAS Build and Submit, a Google Play Console developer registration, and an Apple Developer Program membership for iOS. Install the EAS CLI and run eas login before building; both store enrollments can take days to verify, so start them early.",
          "Rename the application identifiers before the first upload — android.package and ios.bundleIdentifier ship as com.supastack.app in apps/mobile/app.json. Google Play locks the package name at first upload, so a wrong identifier means a new app entry rather than a rename.",
        ],
      },
      {
        id: "credentials",
        title: "Let EAS manage signing",
        paragraphs: [
          "apps/mobile/eas.json defines development, preview, and production build profiles. The production profile lets EAS generate and hold the Android keystore and iOS distribution certificate on its infrastructure — inspect them later with eas credentials, and keep local keystores out of the repository.",
          "Automated Play submission needs a Google Play service-account JSON key linked under Play Console → Setup → API access with release permission. Store it at apps/mobile/secrets/play-store-service-account.json — the path eas.json expects and a git-ignored directory. The first upload of a new app still happens manually in Play Console; eas submit takes over from the second release.",
        ],
      },
      {
        id: "build-submit",
        title: "Build, then submit",
        paragraphs: [
          "Builds run on EAS infrastructure, so no Android Studio or Xcode install is needed for the binary. The production profile produces a store-ready .aab for Play and .ipa for the App Store with remote-managed version numbers. The preview profile produces an internal-distribution APK for physical-device QA.",
          "The shipped submit profile targets the Play internal track as a draft release — nothing reaches testers until you promote it inside Play Console after review passes.",
        ],
        code: "pnpm --filter @supastack/mobile build:android\npnpm --filter @supastack/mobile submit:android\n\npnpm --filter @supastack/mobile build:ios\npnpm --filter @supastack/mobile submit:ios\n\n# Internal-testing APK for a physical device:\npnpm --filter @supastack/mobile build:android:preview",
      },
      {
        id: "console",
        title: "Fill the Play Console forms",
        paragraphs: [
          "Play review gates on declared content as much as the binary: a public privacy policy URL, the Data safety form, the content-rating questionnaire, target audience, and category. Answer Data safety from the app's real behavior — the kit collects account email for authentication, stores session tokens in platform secure storage, and talks only to your configured API; add whatever your product adds on top.",
          "For an iOS app that requires sign-in, provide App Review with a working demo account and instructions in the review notes. Review Apple's current login-services rule and its exceptions before choosing social sign-in options; the requirements depend on the app's actual login flow. The official guidelines are linked in the first-submission section above.",
        ],
      },
      {
        id: "purchases",
        title: "Gate purchases behind RevenueCat first",
        paragraphs: [
          "When your app offers mobile purchases, configure the shipped RevenueCat flow: set `MOBILE_PURCHASES_PROVIDER=revenuecat` and `EXPO_PUBLIC_MOBILE_PURCHASES_PROVIDER=revenuecat`, then provide the matching public iOS or Android SDK key. The native app supports purchase and restore; after either, access refreshes from the server-verified workspace entitlement. Stripe Checkout is not used in the mobile flow. Keep the paywall unavailable when purchases are off or required configuration is missing. Validate configured store products, purchase, restore, and entitlement refresh in an EAS development build with store test accounts. Check current store guidance for requirements that apply to your app and regions.",
        ],
      },
      {
        id: "checklist",
        title: "Pre-submission checklist",
        paragraphs: [],
        items: [
          "android.package and ios.bundleIdentifier renamed to an identifier you own",
          "EXPO_PUBLIC_API_URL in the build environment points at the production API",
          "Privacy policy hosted at a public URL and linked in the store listing",
          "Data safety form matches real collection: auth email, API traffic, anything your product adds",
          "Working demo-account credentials in the App Store review notes",
          "Paywall hidden, or backed by a verified RevenueCat entitlement",
          "Deep-link return, session restore, and sign-out verified on a physical device",
          "Screenshots and listing assets prepared for each store",
        ],
      },
      {
        id: "rejections",
        title: "Recover from a rejection",
        paragraphs: [
          "Rejections arrive with a policy reference — fix the declared cause rather than guessing at the symptom. A Data safety mismatch usually means the form is wrong, not the app. A login-required rejection usually means the review notes lacked a demo account. Resubmit with release notes that name the fix plainly.",
          "The full walkthrough — credential commands, console order of operations, and a rejection playbook — lives in docs/mobile-store-submission.md in the repository.",
        ],
      },
    ],
  },
  {
    slug: "modules",
    tab: "modules",
    group: "Foundation",
    title: "Module overview",
    description: "Small contracts that make the infrastructure easier to understand and reuse.",
    sections: [
      {
        id: "contracts",
        title: "Compose the capabilities you need",
        paragraphs: [
          "The shared packages provide identity, workspace persistence, billing, AI, background jobs, transactional email, and observability. Applications compose these modules; product domain logic stays outside Starter Core.",
          "Prefer the existing contract when integrating a feature. If it cannot describe the behavior you need, make that limitation explicit before expanding it.",
        ],
      },
      {
        id: "ownership",
        title: "Follow ownership through the flow",
        paragraphs: [
          "A session identifies a user. A workspace scopes their records. Entitlements authorize capabilities. A background task carries trusted context into execution. Usage and audit records let the application account for the work afterward.",
        ],
      },
      {
        id: "adapters",
        title: "Use local adapters for deterministic checks",
        paragraphs: [
          "Fake/local adapters support repeatable tests without paid provider requests. Real providers are verified through a separately configured smoke path. An adapter test is evidence about the contract, not proof of real delivery or persistence.",
        ],
      },
    ],
  },
  {
    slug: "modules/workspaces",
    tab: "modules",
    group: "Identity and access",
    title: "Workspaces",
    description: "Scope every user-owned record by workspaceId.",
    sections: [
      {
        id: "ownership",
        title: "Resolve the workspace from the session",
        paragraphs: [
          "Personal workspaces give each user an ownership boundary. The server resolves the current workspace from trusted authentication context. Client-supplied IDs must never replace that check.",
        ],
      },
      {
        id: "reads-writes",
        title: "Scope reads and writes",
        paragraphs: [
          "Include workspaceId in every user-owned lookup or mutation. A detail route needs the same isolation as a list route. Task IDs, recovery URLs, and idempotency keys identify work but do not authorize access.",
          "Apply this rule to your product tables as well as the shared task, usage, and provider configuration records.",
        ],
      },
      {
        id: "tests",
        title: "Test cross-workspace denial",
        paragraphs: [
          "Create two independent workspace contexts. Verify that the owner can read and change their record, the other workspace cannot, and an anonymous request is rejected. Confirm rejected writes leave the persisted record unchanged.",
        ],
      },
    ],
  },
  {
    slug: "modules/auth",
    tab: "modules",
    group: "Identity and access",
    title: "Authentication",
    description: "Identity and sessions through Better Auth.",
    sections: [
      {
        id: "methods",
        title: "Choose enabled sign-in methods",
        paragraphs: [
          "The foundation includes email/password, OTP, and configurable social authentication. Better Auth owns identity and sessions, while the application composes provider configuration and transactional OTP delivery.",
          "Enable only the social providers you have configured. Provider client secrets and the authentication secret stay on the server.",
        ],
      },
      {
        id: "workspace",
        title: "Connect identity to a workspace",
        paragraphs: [
          "Authenticated handlers resolve session state before accessing workspace records. Workspace provisioning must remain idempotent so replaying a lifecycle hook does not create duplicate ownership records.",
        ],
      },
      {
        id: "verify",
        title: "Verify session behavior",
        paragraphs: [
          "Test sign-in, invalid or expired OTPs, single-use consumption, sign-out, and rejected anonymous access. Memory-adapter tests cover handler semantics; production database persistence and real provider callbacks need separate acceptance.",
        ],
      },
    ],
  },
  {
    slug: "modules/ai",
    tab: "modules",
    group: "AI and operations",
    title: "AI and background jobs",
    description: "From an authorized request to a durable result.",
    sections: [
      {
        id: "flow",
        title: "Follow the task lifecycle",
        paragraphs: [
          "The production task API validates the authenticated workspace and entitlement before persisting a task and dispatching the ai.generate Trigger.dev workflow. The router applies capability requirements and configured model policy.",
        ],
        code: "POST /api/ai/tasks\n  → authenticated workspace + entitlement\n  → durable task record\n  → Trigger.dev ai.generate\n  → model routing + generation\n  → usage record + result\n  → transactional completion delivery",
      },
      {
        id: "policy",
        title: "Configure aliases and budgets",
        paragraphs: [
          "The user selects an enabled alias: cheap, fast, or smart. The server controls the underlying model IDs, provider credentials, workspace policy, and budget enforcement. Encrypted bring-your-own-key support must preserve the same server-only boundary.",
        ],
      },
      {
        id: "jobs",
        title: "Keep workflow semantics explicit",
        paragraphs: [
          "JobRunner promises enqueue, status, and cancel only. Trigger.dev workflow semantics are explicit, including durable execution behavior. Do not infer retries or scheduling guarantees from the generic contract.",
          "The production submission path uses idempotency and saved task recovery to handle ambiguous dispatch. Completion of generation is separate from completion-email delivery.",
        ],
      },
    ],
  },
  {
    slug: "modules/billing",
    tab: "modules",
    group: "Identity and access",
    title: "Billing and access",
    description: "Separate payment events from authorization decisions.",
    sections: [
      {
        id: "web",
        title: "Web billing",
        paragraphs: [
          "The Web application supports the billing provider you select with BILLING_PROVIDER; Stripe is one option. Open /billing for Web plans and subscription management. Follow the selected provider's guide to set its server-only credentials, product or price IDs and webhook verification settings in the matching test or live environment.",
        ],
      },
      {
        id: "entitlements",
        title: "Authorize through entitlements",
        paragraphs: [
          "A checkout redirect is not evidence of active access. The server-owned entitlement decides whether a workspace can use a paid capability. Check that entitlement at the action boundary even when the interface already hides the action.",
        ],
      },
      {
        id: "verification",
        title: "Verify the lifecycle",
        paragraphs: [
          "Use sandbox events to verify activation, updates, cancellation, and webhook handling. Keep repeated events safe and ensure an inactive entitlement blocks paid operations. Native mobile purchases remain a separate RevenueCat integration boundary.",
        ],
      },
    ],
  },
  {
    slug: "modules/email",
    tab: "modules",
    group: "AI and operations",
    title: "Transactional email",
    description: "Delivery for authentication and product workflows.",
    sections: [
      {
        id: "scope",
        title: "Keep transactional delivery separate",
        paragraphs: [
          "The email module handles transactional product messages, including authentication and task completion. Outreach belongs to the consuming product’s own workflow and must remain separate from this transactional path.",
        ],
      },
      {
        id: "providers",
        title: "Configure the delivery adapter",
        paragraphs: [
          "Use the local adapter for deterministic tests. Configure the selected production adapter and its server-side credentials before enabling external delivery. Never place mail-provider secrets in client configuration or logs.",
        ],
      },
      {
        id: "delivery",
        title: "Record delivery independently",
        paragraphs: [
          "A generated result and its completion email have separate outcomes. Inspect delivery records before claiming a message was sent successfully. Test a failed delivery without treating it as a failed generation or submitting duplicate model work.",
        ],
      },
    ],
  },
  {
    slug: "modules/observability",
    tab: "modules",
    group: "AI and operations",
    title: "Audit, analytics and errors",
    description:
      "Understand activity with workspace context, sanitized event data, correlated signals and failure alerts.",
    sections: [
      {
        id: "audit",
        title: "Keep a workspace audit trail",
        paragraphs: [
          "Audit records capture changes such as provider configuration updates within a workspace. Resolve the authenticated workspace before reading or writing these records, and preserve that scope when adding product-specific events.",
          "Record the action and identifiers needed to understand it. Provider credentials and other sensitive values must stay out of audit payloads and logs.",
        ],
      },
      {
        id: "analytics",
        title: "Capture product events",
        paragraphs: [
          "The observability package exposes an AnalyticsClient adapter and workspace-scoped AnalyticsEvent values. Each event carries a name, distinct identity, workspaceId, and optional properties.",
          "Use createObservability to route events through your configured analytics client. Structured properties are redacted before delivery; keep sensitive free-form text out of event names and property values as well.",
        ],
      },
      {
        id: "errors",
        title: "Report errors with safe context",
        paragraphs: [
          "ErrorClient captures exceptions with workspaceId tags and structured extra context. The shared observability layer sanitizes exceptions and redacts sensitive context before forwarding them to the configured client.",
          "Use local adapters to verify captured events and exceptions without calling a monitoring provider. Test that workspace tags remain present and credentials are removed before enabling an external destination.",
        ],
      },
      {
        id: "correlation",
        title: "Follow a request across tasks, jobs and webhooks",
        paragraphs: [
          "Entry boundaries mint a corr_<uuid> correlation id that links the originating request to the work it triggers. AI-task submission stamps the id on the task payload and the ai_task_submitted event, every billing webhook receiver mints one per request, and the scheduler mints one per dispatched job.",
          "The same id rides job.completed and ai_task_completed event properties, captureException extras, the webhook_event ledger payload and each webhook_delivery payload meta — so it lands inside the signed body a subscriber receives. Missing or malformed ids are tolerated: the consumer mints a fresh id instead of rejecting older rows.",
        ],
      },
      {
        id: "alerting",
        title: "Alert on real failures",
        paragraphs: [
          "Set ALERT_WEBHOOK_URL to any HTTPS endpoint that accepts a JSON POST shaped {text, name, severity, context}; a Slack-style incoming webhook works as-is. Alerts are fire-and-forget with a five-second timeout, a failed delivery logs one console warning, and the alerter noops while the variable is unset.",
          "The shipped alerts are job.failed (warning — a job handler threw or a job type is unknown) and webhook.delivery_failed (critical — only when an outgoing delivery reaches terminal failure after its final attempt; ordinary retries stay quiet and each delivery row alerts at most once).",
        ],
      },
      {
        id: "metrics",
        title: "Measure durations and stream structured logs",
        paragraphs: [
          "serverObservability.measure times an async operation and emits a <name>.duration analytics event carrying durationMs — on success and on failure, without masking the original error. The ai.task.execute job run is already wrapped, so task execution duration lands in the configured analytics client.",
          "serverObservability.logger writes one JSON line per record to stdout with fixed environment and service labels. Keep log messages static; the logger redacts values under matching sensitive keys in structured context before output. Do not include raw request bodies, credentials, environment-variable values, or URLs in messages or context.",
        ],
      },
    ],
  },
  ...additionalGuides,
  ...featureGuides,
  ...providerGuides,
  ...blockGuides,
  ...referenceGuides,
  ...beginnerGuides,
];
const orderedGuides = organizeGuides(withBeginnerInstructions(baseGuides));
export const guides: readonly Guide[] = withGuideContinuations(
  organizeGuides([...orderedGuides, buildDirectoryGuide(orderedGuides)]),
);
export const categories = ["All articles", ...new Set(posts.map((post) => post.category))];
export function filterPosts(category?: string) {
  return category && categories.includes(category) && category !== "All articles"
    ? posts.filter((post) => post.category === category)
    : posts;
}
export function findGuide(slug: string) {
  return guides.find((guide) => guide.slug === slug);
}
export function searchGuides(query: string, entries: readonly Guide[] = guides) {
  const indexed = buildDocsIndex(entries);
  const matches = rankDocs(indexed, query);
  const bySlug = new Map(entries.map((guide) => [guide.slug, guide]));
  return matches.map((entry) => bySlug.get(entry.slug)!);
}
export function readingMinutes(post: Post) {
  return Math.max(
    1,
    Math.ceil(
      post.sections
        .flatMap((section) => section.paragraphs)
        .join(" ")
        .split(/\s+/).length / 200,
    ),
  );
}
export function formatPostDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
