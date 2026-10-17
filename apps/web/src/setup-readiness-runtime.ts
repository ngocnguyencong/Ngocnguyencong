import "server-only";

import { parseServerConfig } from "@supastack/config";
import { listPendingMigrations } from "@supastack/db";
import { sql } from "drizzle-orm";

import { isAdminRole } from "./admin";
import { database } from "./auth-runtime";
import { rootOgImage, siteOrigin } from "./marketing/seo";
import { siteConfig } from "./marketing/site-config";
import type { SetupSnapshot } from "./setup-readiness";
import { DEFAULT_STYLE_ID } from "./theme/styles";

/**
 * Credentials that look like shipped samples — short values or the usual
 * "placeholder"/"your-*" stand-ins a template ships with.
 */
function looksPlaceholder(value: string | undefined): boolean {
  if (value === undefined) {
    return true;
  }
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length < 10 ||
    normalized.includes("placeholder") ||
    normalized.includes("your-") ||
    normalized.includes("your_")
  );
}

type EnabledOAuth = Readonly<{ clientId: string; clientSecret: string; enabled: true }>;

const SOCIAL_PROVIDERS: readonly Readonly<{
  env: readonly string[];
  key: "apple" | "github" | "google" | "microsoft" | "twitter";
  name: string;
}>[] = [
  { env: ["APPLE_CLIENT_ID", "APPLE_CLIENT_SECRET"], key: "apple", name: "Apple" },
  { env: ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"], key: "github", name: "GitHub" },
  { env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"], key: "google", name: "Google" },
  {
    env: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"],
    key: "microsoft",
    name: "Microsoft",
  },
  { env: ["TWITTER_CLIENT_ID", "TWITTER_CLIENT_SECRET"], key: "twitter", name: "X (Twitter)" },
];

async function countRows(table: "user" | "workspace"): Promise<number> {
  const rows = await database.execute<{ count: number | string }>(
    sql`select count(*) as count from ${sql.raw(`"${table}"`)}`,
  );
  return Number([...rows][0]?.count ?? 0);
}

async function countAdminUsers(): Promise<number> {
  const rows = await database.execute<{ role: string; count: number | string }>(
    sql`select role, count(*) as count from "user" group by role`,
  );
  return [...rows].reduce(
    (total, row) => total + (isAdminRole(row.role) ? Number(row.count) : 0),
    0,
  );
}

/**
 * Gathers the inputs for `evaluateSetupReadiness` — env/config metadata, a
 * DB probe, pending migrations, and small counts. Never returns a secret
 * value: credentials are reduced to booleans, lengths, and "looks like a
 * placeholder" flags before leaving this module.
 */
export async function collectSetupSnapshot(): Promise<SetupSnapshot> {
  const config = parseServerConfig();

  const [reachable, workspaceCount, adminUserCount] = await (async () => {
    try {
      await database.execute(sql`select 1`);
      return [true, await countRows("workspace"), await countAdminUsers()] as const;
    } catch {
      return [false, 0, 0] as const;
    }
  })();

  const pendingMigrations = reachable
    ? await listPendingMigrations(database).catch(() => null)
    : null;

  const methods: string[] = [];
  const placeholderProviders: { env: readonly string[]; name: string }[] = [];
  if (config.auth.providers.emailOtp.enabled) {
    methods.push("Email code");
  }
  if (config.auth.providers.password.enabled) {
    methods.push("Password");
  }
  for (const provider of SOCIAL_PROVIDERS) {
    const oauth = config.auth.providers[provider.key];
    if (!oauth.enabled) {
      continue;
    }
    const enabled = oauth as EnabledOAuth;
    methods.push(provider.name);
    if (looksPlaceholder(enabled.clientId) || looksPlaceholder(enabled.clientSecret)) {
      placeholderProviders.push({ env: provider.env, name: provider.name });
    }
  }

  return {
    admin: { adminUserCount, emailsConfigured: config.admin.emails.length > 0 },
    appUrl: { configured: process.env.APP_URL !== undefined, url: siteOrigin() },
    auth: { methods, placeholderProviders },
    authSecret: {
      configured: process.env.AUTH_SECRET !== undefined,
      length: config.auth.secret.length,
    },
    database: { pendingMigrations, reachable },
    environment: config.app.environment,
    platforms: {
      expoTokenConfigured: config.expo.accessToken !== undefined,
      purchasesConfigured: config.mobilePurchases.kind !== "off",
    },
    product: {
      brandIsDefault: siteConfig.brandName === "supastack",
      socialCardIsDefault: rootOgImage.url === "/demo-social.png",
      styleIsDefault: DEFAULT_STYLE_ID === "obsidian-studio",
    },
    providers: {
      ai: config.providers.ai.kind,
      analytics: config.providers.analytics.kind,
      billing: config.providers.billing.kind,
      captcha: config.providers.captcha.kind,
      customDomains: config.customDomains.kind,
      email: config.providers.email.kind,
      jobs: config.providers.jobs.kind,
      storage: config.providers.storage.kind,
    },
    workspaceCount,
  };
}
