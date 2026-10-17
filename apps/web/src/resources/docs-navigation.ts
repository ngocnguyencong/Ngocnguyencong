import type { Guide } from "./content";

export const DOC_GROUPS = [
  {
    id: "start",
    title: "Getting started",
    description: "Install the kit, understand the structure, and make it yours.",
  },
  {
    id: "tutorials",
    title: "Tutorials",
    description: "Build a complete flow with the shipped contracts.",
  },
  {
    id: "auth",
    title: "Authentication",
    description: "Sign-in methods, sessions, two-factor authentication, and passkeys.",
  },
  {
    id: "billing",
    title: "Billing & entitlements",
    description: "Plans, checkout, signed events, and server-enforced access.",
  },
  {
    id: "ai",
    title: "AI & agents",
    description: "Providers, model policy, chat, BYOK, tools, and MCP.",
  },
  {
    id: "jobs",
    title: "Jobs & email",
    description: "Background tasks, recurring schedules, and transactional delivery.",
  },
  {
    id: "data",
    title: "Database & storage",
    description: "Workspace data, migrations, files, CMS, and commerce.",
  },
  {
    id: "workspace",
    title: "Workspace features",
    description: "Teams, notifications, connected accounts, domains, and feedback.",
  },
  {
    id: "admin",
    title: "Admin & growth",
    description: "Platform administration, flags, announcements, waitlists, and referrals.",
  },
  {
    id: "customization",
    title: "Customization",
    description: "Branding, styles, layouts, locales, public pages, and agent prompts.",
  },
  {
    id: "marketing-blocks",
    title: "Marketing blocks",
    description: "Copyable heroes, features, pricing, testimonials, and conversion sections.",
  },
  {
    id: "app-blocks",
    title: "App blocks",
    description: "Forms, records, loading states, paywalls, and data visualization.",
  },
  {
    id: "chrome-blocks",
    title: "Site chrome",
    description: "Reusable public headers, footers, and prose layouts.",
  },
  {
    id: "mobile",
    title: "Mobile",
    description: "Expo setup, native authentication, purchases, builds, and store submission.",
  },
  {
    id: "desktop",
    title: "Desktop",
    description: "The Tauri shell, native window behavior, and desktop builds.",
  },
  {
    id: "deploy",
    title: "Deployment",
    description: "Managed hosting, Docker, Coolify, Supabase, and release acceptance.",
  },
  {
    id: "security",
    title: "Security & operations",
    description: "Workspace isolation, abuse protection, privacy, health, and observability.",
  },
  {
    id: "reference",
    title: "Reference",
    description:
      "The complete documentation, environment, commands, packages, and API inventories.",
  },
] as const;

const legacyGroups: Record<string, (typeof DOC_GROUPS)[number]["id"]> = {
  web: "start",
  "web/local-setup": "start",
  "web/project-structure": "start",
  "web/adopt-patterns": "start",
  "web/upgrading": "start",
  modules: "start",
  "web/configuration": "reference",
  "web/testing": "security",
  "web/troubleshooting": "security",
  "web/database": "data",
  "web/deployment": "deploy",
  "web/organizations": "workspace",
  "web/seo-public-pages": "customization",
  "web/theming": "customization",
  "web/blog-content": "customization",
  "web/i18n": "customization",
  "web/kit-blocks": "customization",
  "modules/workspaces": "workspace",
  "modules/auth": "auth",
  "modules/billing": "billing",
  "modules/billing-configuration": "billing",
  "modules/billing-custom-adapter": "billing",
  "modules/email": "jobs",
  "modules/email-configuration": "jobs",
  "modules/jobs": "jobs",
  "modules/scheduled-digest": "jobs",
  "modules/observability": "security",
  "modules/public-api": "reference",
  "modules/custom-domains": "workspace",
  "modules/ai": "ai",
  "modules/ai-configuration": "ai",
  "modules/task-recovery": "ai",
  "modules/openrouter": "ai",
  "modules/agent-frameworks": "ai",
  "modules/mcp-server": "ai",
};

export function docsGroupFor(guide: Guide) {
  const id = legacyGroups[guide.slug];
  return (
    DOC_GROUPS.find((group) => group.id === id) ??
    DOC_GROUPS.find((group) => group.title === guide.group) ??
    DOC_GROUPS.find((group) => group.id === (guide.tab === "modules" ? "reference" : guide.tab)) ??
    DOC_GROUPS[0]
  );
}

export function organizeGuides(entries: readonly Guide[]): Guide[] {
  return entries
    .map((guide) => ({ ...guide, group: docsGroupFor(guide).title }))
    .sort((a, b) => {
      const groupOrder = DOC_GROUPS.indexOf(docsGroupFor(a)) - DOC_GROUPS.indexOf(docsGroupFor(b));
      if (groupOrder !== 0) return groupOrder;
      const aQuickstart = a.slug === `${a.tab}/local-setup` ? 0 : 1;
      const bQuickstart = b.slug === `${b.tab}/local-setup` ? 0 : 1;
      return aQuickstart - bQuickstart;
    });
}

export function groupGuides(entries: readonly Guide[]) {
  return DOC_GROUPS.map((group) => ({
    ...group,
    guides: entries.filter((guide) => docsGroupFor(guide).id === group.id),
  })).filter((group) => group.guides.length > 0);
}

/** Shared token matching and stable relevance ranking for GET and palette search. */
export function rankDocs<T extends { title: string; text: string }>(
  entries: readonly T[],
  query: string,
): T[] {
  const term = query.trim().toLowerCase();
  if (!term) return [...entries];
  const words = term.split(/\s+/);
  return entries
    .map((entry, order) => {
      const title = entry.title.toLowerCase();
      const score = words.every((word) => entry.text.includes(word))
        ? (title === term ? 100 : title.includes(term) ? 60 : 0) +
          words.reduce((sum, word) => sum + (title.includes(word) ? 10 : 1), 0)
        : 0;
      return { entry, order, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((item) => item.entry);
}
