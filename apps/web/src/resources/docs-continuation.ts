import type { Guide } from "./content";

const topicNext: Record<string, string> = {
  web: "web/local-setup",
  "web/local-setup": "web/project-structure",
  "web/project-structure": "web/configuration",
  "web/configuration": "web/database",
  "web/database": "deploy/supabase-cloud",
  "modules/auth": "modules/email-configuration",
  "modules/email-otp": "modules/email-configuration",
  "modules/email-configuration": "modules/billing",
  "modules/billing": "modules/product-plans",
  "modules/product-plans": "modules/billing-configuration",
  "modules/billing-configuration": "modules/ai-configuration",
  "modules/ai-configuration": "modules/model-catalog",
  "modules/model-catalog": "modules/jobs",
  "modules/jobs": "modules/schedules",
  "modules/schedules": "modules/scheduled-digest",
  "modules/scheduled-digest": "modules/storage",
  "modules/storage": "web/deployment",
  "web/deployment": "deploy/managed-hosting",
  "deploy/managed-hosting": "security/health",
  "security/health": "web/troubleshooting",
  mobile: "mobile/local-setup",
  "mobile/local-setup": "mobile/authentication",
  "mobile/authentication": "mobile/entitlements",
  "mobile/entitlements": "mobile/in-app-purchases",
  "mobile/in-app-purchases": "mobile/builds",
  "mobile/builds": "mobile/store-submission",
  "mobile/store-submission": "mobile/api-surface",
  "mobile/api-surface": "reference/api-routes",
  desktop: "desktop/local-setup",
  "desktop/local-setup": "desktop/native-behavior",
  "desktop/native-behavior": "desktop/distribution",
  "desktop/distribution": "web/deployment",
  "modules/content": "tutorials/paid-content",
  "modules/entitlements": "tutorials/paid-content",
  "modules/commerce": "modules/webhooks",
  "web/kit-blocks": "tutorials/landing-page",
  "web/theming": "web/layouts",
  "web/layouts": "web/branding",
  "web/branding": "web/seo-public-pages",
  "web/seo-public-pages": "web/deployment",
  "modules/public-api": "modules/mcp-server",
  "modules/mcp-server": "modules/workspace-tools",
  "reference/guides": "web/local-setup",
  modules: "modules/auth",
  "web/adopt-patterns": "web/upgrading",
  "web/upgrading": "web/testing",
  "modules/billing-custom-adapter": "modules/billing-configuration",
  "modules/ai": "modules/ai-configuration",
  "modules/task-recovery": "modules/jobs",
  "modules/openrouter": "modules/model-catalog",
  "modules/agent-frameworks": "modules/workspace-tools",
  "modules/email": "modules/email-configuration",
  "modules/workspaces": "web/organizations",
  "web/organizations": "modules/custom-domains",
  "modules/custom-domains": "web/branding",
  "web/blog-content": "web/seo-public-pages",
  "web/i18n": "web/branding",
  "modules/observability": "security/health",
  "web/testing": "web/troubleshooting",
  "web/troubleshooting": "reference/commands",
  "security/rate-limiting": "security/workspace-isolation",
  "deploy/supabase-cloud": "web/deployment",
  "deploy/supabase-self-hosted": "web/deployment",
  "deploy/coolify-vps": "web/deployment",
  "reference/api-routes": "modules/public-api",
};

const setupFlowNext: Record<string, string> = {
  web: "web/local-setup",
  "web/local-setup": "web/database",
  "web/database": "modules/billing-configuration",
  "modules/billing-configuration": "modules/ai-configuration",
  "modules/ai-configuration": "modules/jobs",
  "modules/jobs": "modules/storage",
  "modules/storage": "web/deployment",
  mobile: "mobile/local-setup",
  "mobile/local-setup": "mobile/authentication",
  "mobile/authentication": "mobile/entitlements",
  "mobile/entitlements": "mobile/in-app-purchases",
  "mobile/in-app-purchases": "mobile/builds",
  "mobile/builds": "mobile/store-submission",
  desktop: "desktop/local-setup",
  "desktop/local-setup": "desktop/native-behavior",
  "desktop/native-behavior": "desktop/distribution",
  "desktop/distribution": "web/deployment",
};

export function withGuideContinuations(entries: readonly Guide[]): Guide[] {
  return entries.map((guide) => {
    const explicit = topicNext[guide.slug] ?? guide.continueTo;
    const destination =
      explicit ??
      (guide.slug.startsWith("providers/")
        ? guide.group === "Authentication"
          ? "modules/email-configuration"
          : guide.group === "Billing & entitlements"
            ? "modules/entitlements"
            : guide.group === "AI & agents"
              ? "modules/model-catalog"
              : "modules/email-templates"
        : guide.slug.startsWith("components/")
          ? guide.group === "App blocks"
            ? "tutorials/protected-page"
            : "tutorials/landing-page"
          : guide.sections
              .flatMap((section) => section.links ?? [])
              .map((link) => link.href.match(/^\/docs\/([^#?]+)$/)?.[1])
              .find((slug) => slug && slug !== guide.slug)) ??
      "reference/guides";
    const setupFlowTo = setupFlowNext[guide.slug];
    return {
      ...guide,
      continueTo: destination,
      ...(setupFlowTo ? { setupFlowTo } : {}),
    };
  });
}

export function guideContinuation(guide: Guide, entries: readonly Guide[]) {
  return entries.find((entry) => entry.slug === guide.continueTo);
}

export function guideSetupFlow(guide: Guide, entries: readonly Guide[]) {
  const next = entries.find((entry) => entry.slug === guide.setupFlowTo);
  return next ? { guide: next } : undefined;
}
