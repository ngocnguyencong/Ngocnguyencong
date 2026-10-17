import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { evaluateSetupReadiness, type SetupSnapshot } from "./setup-readiness";

const here = dirname(fileURLToPath(import.meta.url));

/** A fully-configured production-looking snapshot — every check ready. */
function readySnapshot(): SetupSnapshot {
  return {
    admin: { adminUserCount: 2, emailsConfigured: true },
    appUrl: { configured: true, url: "https://app.example.com" },
    auth: { methods: ["Email code", "Password"], placeholderProviders: [] },
    authSecret: { configured: true, length: 64 },
    database: { pendingMigrations: [], reachable: true },
    environment: "production",
    platforms: { expoTokenConfigured: true, purchasesConfigured: true },
    product: { brandIsDefault: false, socialCardIsDefault: false, styleIsDefault: false },
    providers: {
      ai: "openai",
      analytics: "posthog",
      billing: "stripe",
      captcha: "turnstile",
      customDomains: "cloudflare",
      email: "resend",
      jobs: "trigger",
      storage: "s3",
    },
    workspaceCount: 3,
  };
}

/** A fresh local clone — dev environment, defaults everywhere. */
function freshCloneSnapshot(): SetupSnapshot {
  return {
    admin: { adminUserCount: 0, emailsConfigured: false },
    appUrl: { configured: false, url: "http://localhost:3000" },
    auth: { methods: ["Email code", "Password"], placeholderProviders: [] },
    authSecret: { configured: false, length: 0 },
    database: { pendingMigrations: [], reachable: true },
    environment: "development",
    platforms: { expoTokenConfigured: false, purchasesConfigured: false },
    product: { brandIsDefault: true, socialCardIsDefault: true, styleIsDefault: true },
    providers: {
      ai: "fake",
      analytics: "off",
      billing: "local",
      captcha: "off",
      customDomains: "off",
      email: "local",
      jobs: "local",
      storage: "memory",
    },
    workspaceCount: 0,
  };
}

function checkById(report: ReturnType<typeof evaluateSetupReadiness>, id: string) {
  const found = report.checks.find((check) => check.id === id);
  expect(found, `missing check ${id}`).toBeDefined();
  return found!;
}

describe("evaluateSetupReadiness — foundation", () => {
  it("marks the database action when unreachable and ready when it answers", () => {
    const down = evaluateSetupReadiness({
      ...readySnapshot(),
      database: { pendingMigrations: null, reachable: false },
    });
    expect(checkById(down, "foundation.database").status).toBe("action");
    expect(checkById(evaluateSetupReadiness(readySnapshot()), "foundation.database").status).toBe(
      "ready",
    );
  });

  it("flags pending migrations, an unreadable migration table, and a clean journal", () => {
    const pending = evaluateSetupReadiness({
      ...readySnapshot(),
      database: { pendingMigrations: ["0002_x"], reachable: true },
    });
    const migrations = checkById(pending, "foundation.migrations");
    expect(migrations.status).toBe("action");
    expect(migrations.fix?.command).toContain("db:migrate");

    const unreadable = evaluateSetupReadiness({
      ...readySnapshot(),
      database: { pendingMigrations: null, reachable: true },
    });
    expect(checkById(unreadable, "foundation.migrations").status).toBe("action");
    expect(checkById(unreadable, "foundation.migrations").detail).toBe(
      "Could not read migration state",
    );

    expect(checkById(evaluateSetupReadiness(readySnapshot()), "foundation.migrations").status).toBe(
      "ready",
    );
  });

  it("requires an explicit APP_URL that is https + non-local outside development", () => {
    const prod = evaluateSetupReadiness(readySnapshot());
    expect(checkById(prod, "foundation.app-url").status).toBe("ready");

    for (const [environment, url, configured, expected] of [
      ["production", "http://localhost:3000", false, "action"],
      ["production", "http://app.example.com", true, "action"],
      ["production", "https://localhost:3000", true, "action"],
      ["development", "http://localhost:3000", true, "ready"],
      ["development", "http://localhost:3000", false, "action"],
      ["local", "http://localhost:3000", true, "ready"],
      ["local", "http://app.example.com", true, "ready"],
      ["test", "http://localhost:3000", true, "ready"],
      ["test", "https://localhost:3000", true, "ready"],
    ] as const) {
      const report = evaluateSetupReadiness({
        ...readySnapshot(),
        appUrl: { configured, url },
        environment,
      });
      expect(
        checkById(report, "foundation.app-url").status,
        `${environment} ${url} configured=${configured}`,
      ).toBe(expected);
    }
  });

  it("requires a 32+ char auth secret; the dev default reports demo, missing in prod is action", () => {
    const devDefault = evaluateSetupReadiness(freshCloneSnapshot());
    expect(checkById(devDefault, "foundation.auth-secret").status).toBe("demo");

    const prodMissing = evaluateSetupReadiness({
      ...readySnapshot(),
      authSecret: { configured: false, length: 0 },
    });
    expect(checkById(prodMissing, "foundation.auth-secret").status).toBe("action");

    const short = evaluateSetupReadiness({
      ...readySnapshot(),
      authSecret: { configured: true, length: 12 },
    });
    expect(checkById(short, "foundation.auth-secret").status).toBe("action");

    for (const environment of ["local", "test"] as const) {
      const missing = evaluateSetupReadiness({
        ...readySnapshot(),
        authSecret: { configured: false, length: 0 },
        environment,
      });
      expect(checkById(missing, "foundation.auth-secret").status, environment).toBe("demo");
    }
  });
});

describe("evaluateSetupReadiness — accounts", () => {
  it("lists enabled sign-in methods and requires at least one", () => {
    const report = evaluateSetupReadiness(readySnapshot());
    const signIn = checkById(report, "accounts.sign-in");
    expect(signIn.status).toBe("ready");
    expect(signIn.detail).toContain("Email code");

    const none = evaluateSetupReadiness({
      ...readySnapshot(),
      auth: { methods: [], placeholderProviders: [] },
    });
    expect(checkById(none, "accounts.sign-in").status).toBe("action");
  });

  it("flags enabled social providers whose credentials look like placeholders", () => {
    const report = evaluateSetupReadiness({
      ...readySnapshot(),
      auth: {
        methods: ["Email code", "Google"],
        placeholderProviders: [
          { env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"], name: "Google" },
        ],
      },
    });
    const check = checkById(report, "accounts.oauth-credentials");
    expect(check.status).toBe("action");
    expect(check.detail).toContain("Google");
    expect(check.fix?.env).toEqual(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]);
  });

  it("requires admin bootstrap via ADMIN_EMAILS or an existing admin user", () => {
    const report = evaluateSetupReadiness(readySnapshot());
    expect(checkById(report, "accounts.admin").status).toBe("ready");

    const missing = evaluateSetupReadiness({
      ...readySnapshot(),
      admin: { adminUserCount: 0, emailsConfigured: false },
    });
    const check = checkById(missing, "accounts.admin");
    expect(check.status).toBe("action");
    expect(check.fix?.env).toEqual(["ADMIN_EMAILS"]);
  });

  it("suggests a first workspace as optional when none exist", () => {
    const report = evaluateSetupReadiness(freshCloneSnapshot());
    const check = checkById(report, "accounts.first-workspace");
    expect(check.status).toBe("optional");
    expect(check.detail).toContain("/onboarding");

    const ready = evaluateSetupReadiness(readySnapshot());
    expect(checkById(ready, "accounts.first-workspace").status).toBe("ready");
  });
});

describe("evaluateSetupReadiness — providers", () => {
  it("maps demo-mode providers to demo with selector env + doc link", () => {
    const report = evaluateSetupReadiness(freshCloneSnapshot());
    const email = checkById(report, "providers.email");
    expect(email.status).toBe("demo");
    expect(email.detail).toContain("/mail-preview");
    expect(email.fix?.env).toEqual(["EMAIL_PROVIDER"]);
    expect(email.fix?.docHref).toBe("/docs/modules/email");

    const billing = checkById(report, "providers.billing");
    expect(billing.status).toBe("demo");
    expect(billing.fix?.env).toEqual(["BILLING_PROVIDER"]);

    const ai = checkById(report, "providers.ai");
    expect(ai.status).toBe("demo");
    expect(ai.fix?.env).toEqual(["AI_PROVIDER"]);

    const storage = checkById(report, "providers.storage");
    expect(storage.status).toBe("demo");
    expect(storage.fix?.env).toEqual(["STORAGE_PROVIDER"]);
  });

  it("marks optional providers optional and real providers ready", () => {
    const fresh = evaluateSetupReadiness(freshCloneSnapshot());
    for (const id of [
      "providers.jobs",
      "providers.analytics",
      "providers.captcha",
      "providers.custom-domains",
    ]) {
      expect(checkById(fresh, id).status, id).toBe("optional");
    }

    const prod = evaluateSetupReadiness(readySnapshot());
    for (const id of [
      "providers.email",
      "providers.billing",
      "providers.ai",
      "providers.storage",
      "providers.jobs",
      "providers.analytics",
      "providers.captcha",
      "providers.custom-domains",
    ]) {
      expect(checkById(prod, id).status, id).toBe("ready");
    }
  });
});

describe("evaluateSetupReadiness — product", () => {
  it("flags the demo brand as action and default style/social card as optional", () => {
    const report = evaluateSetupReadiness(freshCloneSnapshot());
    const brand = checkById(report, "product.brand");
    expect(brand.status).toBe("action");
    expect(brand.fix?.file).toBe("apps/web/src/marketing/site-config.ts");

    const style = checkById(report, "product.style");
    expect(style.status).toBe("optional");
    expect(style.fix?.docHref).toBe("/docs/web/theming");

    expect(checkById(report, "product.social-card").status).toBe("optional");

    const done = evaluateSetupReadiness(readySnapshot());
    for (const id of ["product.brand", "product.style", "product.social-card"]) {
      expect(checkById(done, id).status, id).toBe("ready");
    }
  });
});

describe("evaluateSetupReadiness — platforms", () => {
  it("marks missing mobile wiring optional and keeps the desktop updater info row", () => {
    const report = evaluateSetupReadiness(freshCloneSnapshot());
    for (const id of [
      "platforms.mobile-purchases",
      "platforms.expo-token",
      "platforms.desktop-updater",
    ]) {
      expect(checkById(report, id).status, id).toBe("optional");
    }
    expect(checkById(report, "platforms.desktop-updater").detail).toContain(
      "docs/desktop-updates.md",
    );

    const done = evaluateSetupReadiness(readySnapshot());
    expect(checkById(done, "platforms.mobile-purchases").status).toBe("ready");
    expect(checkById(done, "platforms.expo-token").status).toBe("ready");
    expect(checkById(done, "platforms.desktop-updater").status).toBe("optional");
  });
});

describe("evaluateSetupReadiness — report shape", () => {
  it("sorts action items first within each group and counts statuses", () => {
    const report = evaluateSetupReadiness(freshCloneSnapshot());
    const groups = new Map<string, string[]>();
    for (const check of report.checks) {
      const list = groups.get(check.group) ?? [];
      list.push(check.status);
      groups.set(check.group, list);
    }
    for (const statuses of groups.values()) {
      const lastAction = statuses.lastIndexOf("action");
      const firstNonAction = statuses.findIndex((status) => status !== "action");
      expect(lastAction === -1 || firstNonAction === -1 || lastAction < firstNonAction).toBe(true);
    }
    expect(report.counts).toEqual({
      action: report.checks.filter((c) => c.status === "action").length,
      demo: report.checks.filter((c) => c.status === "demo").length,
      optional: report.checks.filter((c) => c.status === "optional").length,
      ready: report.checks.filter((c) => c.status === "ready").length,
    });
  });

  it("readyForProduction is true only with no actions and no demo in foundation/accounts/email/billing", () => {
    expect(evaluateSetupReadiness(readySnapshot()).readyForProduction).toBe(true);

    // Fresh clone: actions (brand, admin, app-url) + demo (email, billing, ai, storage, secret)
    expect(evaluateSetupReadiness(freshCloneSnapshot()).readyForProduction).toBe(false);

    // Demo AI/storage do not block; demo email does.
    const demoAi = evaluateSetupReadiness({
      ...readySnapshot(),
      providers: { ...readySnapshot().providers, ai: "fake", storage: "memory" },
    });
    expect(demoAi.readyForProduction).toBe(true);

    const demoEmail = evaluateSetupReadiness({
      ...readySnapshot(),
      providers: { ...readySnapshot().providers, email: "local" },
    });
    expect(demoEmail.readyForProduction).toBe(false);

    const demoBilling = evaluateSetupReadiness({
      ...readySnapshot(),
      providers: { ...readySnapshot().providers, billing: "local" },
    });
    expect(demoBilling.readyForProduction).toBe(false);
  });

  it("never serializes secret values — only booleans, kinds, and lengths", () => {
    const secret = "super-secret-value-0123456789abcdef";
    const snapshot: SetupSnapshot = {
      ...readySnapshot(),
      // The collector must reduce secrets to metadata before evaluate runs;
      // assert the report shape could not carry the value even if length leaks.
      authSecret: { configured: true, length: secret.length },
    };
    const serialized = JSON.stringify(evaluateSetupReadiness(snapshot));
    expect(serialized).not.toContain(secret);
    for (const check of evaluateSetupReadiness(snapshot).checks) {
      expect(JSON.stringify(check.fix ?? {})).not.toContain(secret);
    }
  });
});

describe("setup readiness doc links", () => {
  it("every docHref resolves to a real guide slug", () => {
    const guidesSource =
      readFileSync(join(here, "resources", "content.ts"), "utf8") +
      readFileSync(join(here, "resources", "additional-guides.ts"), "utf8");
    const slugs = new Set([
      // Guides declared inline use `slug: "…"`; additional-guides.ts builds
      // them through the `guide("slug", …)` helper.
      ...[...guidesSource.matchAll(/slug:\s*"([^"]+)"/g)].map((match) => match[1]),
      ...[...guidesSource.matchAll(/guide\(\s*"([^"]+)"/g)].map((match) => match[1]),
    ]);
    const report = evaluateSetupReadiness(freshCloneSnapshot());
    const hrefs = report.checks
      .map((check) => check.fix?.docHref)
      .filter((href): href is string => href !== undefined);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href.startsWith("/docs/"), href).toBe(true);
      expect(slugs.has(href.slice("/docs/".length)), href).toBe(true);
    }
  });
});
