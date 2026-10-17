/**
 * Pure readiness evaluation for the `/setup` checklist. The snapshot carries
 * booleans, kinds, and lengths only — `setup-readiness-runtime.ts` reduces
 * every secret to metadata before it reaches this module, so nothing here
 * can leak a credential into the rendered report.
 */

export type SetupCheckStatus = "ready" | "action" | "demo" | "optional";
export type SetupCheckGroup = "foundation" | "accounts" | "providers" | "product" | "platforms";

export type SetupCheckFix = Readonly<{
  /** Environment variables that control the check (rendered as code). */
  env?: readonly string[];
  /** A shell command that resolves or helps the check. */
  command?: string;
  /** An in-app docs guide link (/docs/<slug>). */
  docHref?: string;
  /** A repository file path to edit (rendered as code). */
  file?: string;
}>;

export type SetupCheck = Readonly<{
  id: string;
  group: SetupCheckGroup;
  label: string;
  status: SetupCheckStatus;
  detail: string;
  fix?: SetupCheckFix;
}>;

export type SetupSnapshot = Readonly<{
  /** `config.app.environment` — "local" | "development" | "test" | "production".
   *  Only "production" enables strict URL/secret requirements. */
  environment: string;
  appUrl: Readonly<{ configured: boolean; url: string }>;
  /** Reduced secret metadata — never the value itself. */
  authSecret: Readonly<{ configured: boolean; length: number }>;
  database: Readonly<{
    reachable: boolean;
    /** Journal tags not yet applied; `null` = state unreadable (query error). */
    pendingMigrations: readonly string[] | null;
  }>;
  auth: Readonly<{
    /** Enabled sign-in method labels, e.g. "Email code", "Google". */
    methods: readonly string[];
    /** Enabled social providers whose credentials look like placeholders. */
    placeholderProviders: readonly Readonly<{ env: readonly string[]; name: string }>[];
  }>;
  admin: Readonly<{ emailsConfigured: boolean; adminUserCount: number }>;
  workspaceCount: number;
  providers: Readonly<{
    ai: string;
    analytics: string;
    billing: string;
    captcha: string;
    customDomains: string;
    email: string;
    jobs: string;
    storage: string;
  }>;
  product: Readonly<{
    brandIsDefault: boolean;
    socialCardIsDefault: boolean;
    styleIsDefault: boolean;
  }>;
  platforms: Readonly<{ expoTokenConfigured: boolean; purchasesConfigured: boolean }>;
}>;

export type SetupReport = Readonly<{
  checks: readonly SetupCheck[];
  counts: Record<SetupCheckStatus, number>;
  readyForProduction: boolean;
}>;

const GROUP_ORDER: readonly SetupCheckGroup[] = [
  "foundation",
  "accounts",
  "providers",
  "product",
  "platforms",
];

/** Action first, then demo, then optional, then ready — signal-first rows. */
const STATUS_RANK: Record<SetupCheckStatus, number> = {
  action: 0,
  demo: 1,
  optional: 2,
  ready: 3,
};

function isLocalOrInsecure(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const local =
      host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
    return local || parsed.protocol !== "https:";
  } catch {
    return true;
  }
}

function foundationChecks(snapshot: SetupSnapshot): SetupCheck[] {
  const checks: SetupCheck[] = [];

  checks.push(
    snapshot.database.reachable
      ? {
          detail: "PostgreSQL answers queries.",
          group: "foundation",
          id: "foundation.database",
          label: "Database reachable",
          status: "ready",
        }
      : {
          detail: "The database is not reachable — the app runs without saved data.",
          fix: {
            command: "docker compose up -d postgres",
            env: ["DATABASE_URL"],
          },
          group: "foundation",
          id: "foundation.database",
          label: "Database reachable",
          status: "action",
        },
  );

  if (snapshot.database.pendingMigrations === null) {
    checks.push({
      detail: "Could not read migration state",
      fix: { command: "corepack pnpm --filter @supastack/db db:migrate" },
      group: "foundation",
      id: "foundation.migrations",
      label: "Migrations applied",
      status: "action",
    });
  } else if (snapshot.database.pendingMigrations.length > 0) {
    const count = snapshot.database.pendingMigrations.length;
    checks.push({
      detail: `${count} migration${count === 1 ? "" : "s"} pending (${snapshot.database.pendingMigrations.join(", ")}).`,
      fix: { command: "corepack pnpm --filter @supastack/db db:migrate" },
      group: "foundation",
      id: "foundation.migrations",
      label: "Migrations applied",
      status: "action",
    });
  } else {
    checks.push({
      detail: "Every bundled migration is applied.",
      group: "foundation",
      id: "foundation.migrations",
      label: "Migrations applied",
      status: "ready",
    });
  }

  if (!snapshot.appUrl.configured) {
    checks.push({
      detail: `APP_URL is not set — the app falls back to ${snapshot.appUrl.url}.`,
      fix: { env: ["APP_URL"] },
      group: "foundation",
      id: "foundation.app-url",
      label: "App URL configured",
      status: "action",
    });
  } else if (snapshot.environment === "production" && isLocalOrInsecure(snapshot.appUrl.url)) {
    checks.push({
      detail: "APP_URL must be an exact, non-local HTTPS origin outside production.",
      fix: { env: ["APP_URL"] },
      group: "foundation",
      id: "foundation.app-url",
      label: "App URL configured",
      status: "action",
    });
  } else {
    checks.push({
      detail: `Serving from ${snapshot.appUrl.url}.`,
      group: "foundation",
      id: "foundation.app-url",
      label: "App URL configured",
      status: "ready",
    });
  }

  if (snapshot.authSecret.configured && snapshot.authSecret.length >= 32) {
    checks.push({
      detail: "AUTH_SECRET is set and long enough.",
      group: "foundation",
      id: "foundation.auth-secret",
      label: "Auth secret",
      status: "ready",
    });
  } else if (snapshot.authSecret.configured) {
    checks.push({
      detail: "AUTH_SECRET must contain at least 32 characters.",
      fix: { env: ["AUTH_SECRET"] },
      group: "foundation",
      id: "foundation.auth-secret",
      label: "Auth secret",
      status: "action",
    });
  } else if (snapshot.environment !== "production") {
    checks.push({
      detail: "Using the built-in development secret — set AUTH_SECRET before deploying.",
      fix: { env: ["AUTH_SECRET"] },
      group: "foundation",
      id: "foundation.auth-secret",
      label: "Auth secret",
      status: "demo",
    });
  } else {
    checks.push({
      detail: "AUTH_SECRET is not set — sessions cannot be signed securely.",
      fix: { env: ["AUTH_SECRET"] },
      group: "foundation",
      id: "foundation.auth-secret",
      label: "Auth secret",
      status: "action",
    });
  }

  return checks;
}

function accountsChecks(snapshot: SetupSnapshot): SetupCheck[] {
  const checks: SetupCheck[] = [];

  checks.push(
    snapshot.auth.methods.length > 0
      ? {
          detail: `Enabled: ${snapshot.auth.methods.join(", ")}.`,
          group: "accounts",
          id: "accounts.sign-in",
          label: "Sign-in methods",
          status: "ready",
        }
      : {
          detail: "No sign-in methods are enabled.",
          fix: { docHref: "/docs/modules/auth" },
          group: "accounts",
          id: "accounts.sign-in",
          label: "Sign-in methods",
          status: "action",
        },
  );

  if (snapshot.auth.placeholderProviders.length > 0) {
    checks.push({
      detail: `Enabled with placeholder-looking credentials: ${snapshot.auth.placeholderProviders
        .map((provider) => provider.name)
        .join(", ")}.`,
      fix: { env: snapshot.auth.placeholderProviders.flatMap((provider) => provider.env) },
      group: "accounts",
      id: "accounts.oauth-credentials",
      label: "Social provider credentials",
      status: "action",
    });
  } else {
    checks.push({
      detail: "No enabled social provider uses placeholder credentials.",
      group: "accounts",
      id: "accounts.oauth-credentials",
      label: "Social provider credentials",
      status: "ready",
    });
  }

  checks.push(
    snapshot.admin.emailsConfigured || snapshot.admin.adminUserCount > 0
      ? {
          detail: snapshot.admin.emailsConfigured
            ? "ADMIN_EMAILS bootstraps the first platform admin."
            : `${snapshot.admin.adminUserCount} platform admin ${
                snapshot.admin.adminUserCount === 1 ? "user exists" : "users exist"
              }.`,
          group: "accounts",
          id: "accounts.admin",
          label: "Admin access",
          status: "ready",
        }
      : {
          detail: "No platform admin is configured — set ADMIN_EMAILS before the first sign-in.",
          fix: { env: ["ADMIN_EMAILS"] },
          group: "accounts",
          id: "accounts.admin",
          label: "Admin access",
          status: "action",
        },
  );

  checks.push(
    snapshot.workspaceCount > 0
      ? {
          detail: `${snapshot.workspaceCount} workspace${
            snapshot.workspaceCount === 1 ? "" : "s"
          } exist.`,
          group: "accounts",
          id: "accounts.first-workspace",
          label: "First workspace",
          status: "ready",
        }
      : {
          detail: "Create your first workspace from /onboarding.",
          group: "accounts",
          id: "accounts.first-workspace",
          label: "First workspace",
          status: "optional",
        },
  );

  return checks;
}

function providerChecks(snapshot: SetupSnapshot): SetupCheck[] {
  const { providers } = snapshot;
  const checks: SetupCheck[] = [];

  checks.push(
    providers.email === "local"
      ? {
          detail: "Emails are captured in the local outbox at /mail-preview instead of being sent.",
          fix: { docHref: "/docs/modules/email", env: ["EMAIL_PROVIDER"] },
          group: "providers",
          id: "providers.email",
          label: "Email",
          status: "demo",
        }
      : {
          detail: `Email sends through ${providers.email}.`,
          group: "providers",
          id: "providers.email",
          label: "Email",
          status: "ready",
        },
  );

  checks.push(
    providers.billing === "local"
      ? {
          detail: "Checkout completes locally without charging a real card.",
          fix: { docHref: "/docs/modules/billing", env: ["BILLING_PROVIDER"] },
          group: "providers",
          id: "providers.billing",
          label: "Billing",
          status: "demo",
        }
      : {
          detail: `Billing runs through ${providers.billing}.`,
          group: "providers",
          id: "providers.billing",
          label: "Billing",
          status: "ready",
        },
  );

  checks.push(
    providers.ai === "fake"
      ? {
          detail: "AI features return deterministic demo responses.",
          fix: { docHref: "/docs/modules/ai", env: ["AI_PROVIDER"] },
          group: "providers",
          id: "providers.ai",
          label: "AI provider",
          status: "demo",
        }
      : {
          detail: `AI calls run through ${providers.ai}.`,
          group: "providers",
          id: "providers.ai",
          label: "AI provider",
          status: "ready",
        },
  );

  checks.push(
    providers.storage === "memory"
      ? {
          detail: "Uploaded files live in memory and disappear on restart.",
          fix: { env: ["STORAGE_PROVIDER"] },
          group: "providers",
          id: "providers.storage",
          label: "File storage",
          status: "demo",
        }
      : {
          detail: `Files persist through ${providers.storage}.`,
          group: "providers",
          id: "providers.storage",
          label: "File storage",
          status: "ready",
        },
  );

  checks.push(
    providers.jobs === "local"
      ? {
          detail: "Jobs run in-process — fine for development, not a durable production queue.",
          fix: { docHref: "/docs/modules/jobs", env: ["JOB_PROVIDER"] },
          group: "providers",
          id: "providers.jobs",
          label: "Background jobs",
          status: "optional",
        }
      : {
          detail: `Jobs run through ${providers.jobs}.`,
          group: "providers",
          id: "providers.jobs",
          label: "Background jobs",
          status: "ready",
        },
  );

  checks.push(
    providers.analytics === "off" || providers.analytics === "local"
      ? {
          detail:
            providers.analytics === "local"
              ? "The self-hosted local analytics beacon is enabled."
              : "No analytics provider is configured.",
          fix: { docHref: "/docs/modules/observability", env: ["ANALYTICS_PROVIDER"] },
          group: "providers",
          id: "providers.analytics",
          label: "Analytics",
          status: "optional",
        }
      : {
          detail: `Analytics reports through ${providers.analytics}.`,
          group: "providers",
          id: "providers.analytics",
          label: "Analytics",
          status: "ready",
        },
  );

  checks.push(
    providers.captcha === "off"
      ? {
          detail: "Abuse protection is off.",
          fix: { env: ["CAPTCHA_PROVIDER"] },
          group: "providers",
          id: "providers.captcha",
          label: "Captcha",
          status: "optional",
        }
      : {
          detail: `Captcha runs through ${providers.captcha}.`,
          group: "providers",
          id: "providers.captcha",
          label: "Captcha",
          status: "ready",
        },
  );

  checks.push(
    providers.customDomains === "cloudflare"
      ? {
          detail: "Custom workspace domains resolve through Cloudflare for SaaS.",
          group: "providers",
          id: "providers.custom-domains",
          label: "Custom domains",
          status: "ready",
        }
      : {
          detail:
            providers.customDomains === "local"
              ? "Custom domains are simulated locally."
              : "Custom workspace domains are off.",
          fix: { docHref: "/docs/modules/custom-domains", env: ["CUSTOM_DOMAINS_PROVIDER"] },
          group: "providers",
          id: "providers.custom-domains",
          label: "Custom domains",
          status: "optional",
        },
  );

  return checks;
}

function productChecks(snapshot: SetupSnapshot): SetupCheck[] {
  const checks: SetupCheck[] = [];

  checks.push(
    snapshot.product.brandIsDefault
      ? {
          detail: "The demo brand is still live — rename the product before shipping.",
          fix: { file: "apps/web/src/marketing/site-config.ts" },
          group: "product",
          id: "product.brand",
          label: "Product name",
          status: "action",
        }
      : {
          detail: "The product uses its own brand.",
          group: "product",
          id: "product.brand",
          label: "Product name",
          status: "ready",
        },
  );

  checks.push(
    snapshot.product.styleIsDefault
      ? {
          detail: "The default design style is active — pick one that fits the product.",
          fix: { docHref: "/docs/web/theming" },
          group: "product",
          id: "product.style",
          label: "Design style",
          status: "optional",
        }
      : {
          detail: "A non-default design style is configured.",
          group: "product",
          id: "product.style",
          label: "Design style",
          status: "ready",
        },
  );

  checks.push(
    snapshot.product.socialCardIsDefault
      ? {
          detail: "The demo social card still ships — replace it with product art.",
          fix: { file: "apps/web/public/demo-social.png" },
          group: "product",
          id: "product.social-card",
          label: "Social card",
          status: "optional",
        }
      : {
          detail: "A custom social card is configured.",
          group: "product",
          id: "product.social-card",
          label: "Social card",
          status: "ready",
        },
  );

  return checks;
}

function platformChecks(snapshot: SetupSnapshot): SetupCheck[] {
  return [
    snapshot.platforms.purchasesConfigured
      ? {
          detail: "Mobile purchases run through the configured provider.",
          group: "platforms",
          id: "platforms.mobile-purchases",
          label: "Mobile purchases",
          status: "ready",
        }
      : {
          detail: "In-app purchases are off — paywalled mobile features show the demo state.",
          fix: { docHref: "/docs/mobile/in-app-purchases", env: ["MOBILE_PURCHASES_PROVIDER"] },
          group: "platforms",
          id: "platforms.mobile-purchases",
          label: "Mobile purchases",
          status: "optional",
        },
    snapshot.platforms.expoTokenConfigured
      ? {
          detail: "EXPO_ACCESS_TOKEN is set for cloud builds and submissions.",
          group: "platforms",
          id: "platforms.expo-token",
          label: "Expo access token",
          status: "ready",
        }
      : {
          detail: "EXPO_ACCESS_TOKEN is unset — EAS builds need it in CI.",
          fix: { docHref: "/docs/mobile/store-submission", env: ["EXPO_ACCESS_TOKEN"] },
          group: "platforms",
          id: "platforms.expo-token",
          label: "Expo access token",
          status: "optional",
        },
    {
      detail:
        "The desktop updater is configured in the Tauri build, not on the web server — see docs/desktop-updates.md.",
      group: "platforms",
      id: "platforms.desktop-updater",
      label: "Desktop updater",
      status: "optional",
    },
  ];
}

/**
 * Groups are emitted in a fixed order; checks sort signal-first within each
 * group (action → demo → optional → ready), keeping authored order within
 * the same status.
 */
export function evaluateSetupReadiness(snapshot: SetupSnapshot): SetupReport {
  const unordered = [
    ...foundationChecks(snapshot),
    ...accountsChecks(snapshot),
    ...providerChecks(snapshot),
    ...productChecks(snapshot),
    ...platformChecks(snapshot),
  ];
  const checks = GROUP_ORDER.flatMap((group) =>
    unordered
      .filter((check) => check.group === group)
      .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]),
  );

  const counts: Record<SetupCheckStatus, number> = { action: 0, demo: 0, optional: 0, ready: 0 };
  for (const check of checks) {
    counts[check.status] += 1;
  }

  // Demo mode is acceptable for local iteration, but not for foundation
  // plumbing, account bootstrap, or the transactional email/billing rails.
  const blocksProduction = (check: SetupCheck) =>
    check.status === "action" ||
    (check.status === "demo" &&
      (check.group === "foundation" ||
        check.group === "accounts" ||
        check.id === "providers.email" ||
        check.id === "providers.billing"));

  return Object.freeze({
    checks,
    counts,
    readyForProduction: !checks.some(blocksProduction),
  });
}
