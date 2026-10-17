import { DEFAULT_LOCALE, getDictionary, localePath } from "@supastack/i18n";

import { guides, posts, type Guide, type Post } from "../resources/content";
import { groupGuides } from "../resources/docs-navigation";
import { marketingStaticPaths } from "./marketing-sitemap";
import { siteConfig } from "./site-config";

type MarketingStaticPath = (typeof marketingStaticPaths)[number];

/**
 * Labels + one-line summaries for the static public pages, keyed by
 * `marketingStaticPaths` so adding a public route fails typecheck until it
 * gets an entry — the same contract `STATIC_ENTRY_META` gives the sitemap.
 * Wording stays neutral: this index ships in every product built on the kit.
 */
const STATIC_PAGE_INFO: Record<MarketingStaticPath, { label: string; description: string }> = {
  "/": {
    label: "Home",
    // The dictionary copy is the canonical landing description — it rebrands
    // with the product instead of duplicating a hardcoded sentence here.
    description: getDictionary(DEFAULT_LOCALE).marketingLanding.metadataDescription,
  },
  "/faq": {
    label: "FAQ",
    description: "Answers about the demo, supported platforms, billing, and getting started.",
  },
  "/blog": {
    label: "Blog",
    description: "Engineering notes, architectural decisions, and practical build guides.",
  },
  "/docs": {
    label: "Docs",
    description:
      "Documentation index for the web app, mobile app, desktop shell, and shared modules.",
  },
  "/contact": {
    label: "Contact",
    description: "Contact page for product questions and notes.",
  },
  "/privacy": {
    label: "Privacy",
    description: "How account, workspace, billing, and contact information is handled.",
  },
  "/terms": {
    label: "Terms",
    description: "Terms of use for the website and product.",
  },
  "/legal/acceptable-use": {
    label: "Acceptable use",
    description: "Acceptable use policy for the website and product.",
  },
  "/legal/disclaimer": {
    label: "Disclaimer",
    description: "Legal disclaimer for the demo content.",
  },
  "/legal/license": {
    label: "License",
    description: "License terms for building a product on this codebase.",
  },
  "/showcase": {
    label: "Showcase",
    description: "Products built on this codebase.",
  },
  "/changelog": {
    label: "Changelog",
    description: "Shipped changes to the demo codebase, newest first.",
  },
  "/roadmap": {
    label: "Roadmap",
    description: "Curated view of shipped, in-progress, and planned work.",
  },
  "/api-reference": {
    label: "API reference",
    description:
      "Endpoint list for the versioned REST API, rendered from the published OpenAPI document.",
  },
};

/**
 * Public machine-facing endpoints worth indexing for agents. Only entries
 * that exist as shipped routes belong here — products editing this index
 * keep the list in sync with their own public API surface.
 */
const REFERENCE_LINKS = [
  {
    path: "/status",
    label: "Status page",
    description: "Live health of this deployment's subsystems.",
  },
  {
    path: "/api/health",
    label: "Health probe",
    description: "JSON dependency health snapshot; provider secrets are never included.",
  },
  {
    path: "/api/v1/openapi",
    label: "OpenAPI document",
    description:
      "Machine-readable contract for the versioned /api/v1 REST API. Endpoints accept an authenticated session or a scoped Bearer sk_ API key.",
  },
  {
    path: "/api/mcp",
    label: "MCP endpoint",
    description:
      "Streamable HTTP MCP server. POST only; requires a scoped Bearer sk_ API key and filters tools by the key's scopes.",
  },
] as const;

/** Markdown-link-safe one-liner: no brackets, no newlines. */
function inline(text: string): string {
  return text.replace(/[[\]]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * llmstxt.org-format body for `GET /llms.txt`. `origin` is the canonical site
 * origin (`siteOrigin()` in the route) because emitted links are absolute so
 * they resolve outside the site. Paths use the default locale's canonical
 * shape — the same unprefixed URLs the sitemap emits as `x-default`.
 */
export function buildLlmsTxt(
  origin: string,
  input?: { guides?: readonly Guide[]; posts?: readonly Post[] },
): string {
  const allGuides = input?.guides ?? guides;
  const articles = input?.posts ?? posts;
  const link = (path: string) => new URL(path, origin).toString();

  const lines: string[] = [
    `# ${inline(siteConfig.brandName)}`,
    "",
    `> ${inline(siteConfig.tagline)}`,
    "",
    "This index lists the site's public surface for AI agents. Products built on this codebase edit it in `apps/web/app/llms.txt/route.ts`.",
    "",
    "## Docs",
  ];

  for (const group of groupGuides(allGuides)) {
    lines.push("", `### ${inline(group.title)}`, "");
    for (const guide of group.guides) {
      const path = localePath(DEFAULT_LOCALE, `/docs/${guide.slug}`);
      lines.push(`- [${inline(guide.title)}](${link(path)}): ${inline(guide.description)}`);
    }
  }

  lines.push("", "## Pages", "");
  for (const path of marketingStaticPaths) {
    const { label, description } = STATIC_PAGE_INFO[path];
    lines.push(
      `- [${inline(label)}](${link(localePath(DEFAULT_LOCALE, path))}): ${inline(description)}`,
    );
  }

  if (articles.length > 0) {
    lines.push("", "## Blog", "");
    for (const post of articles) {
      const path = localePath(DEFAULT_LOCALE, `/blog/${post.slug}`);
      lines.push(`- [${inline(post.title)}](${link(path)}): ${inline(post.description)}`);
    }
  }

  lines.push("", "## Security protocols", "");
  lines.push(
    `- [Authentication](${link(localePath(DEFAULT_LOCALE, "/docs/modules/auth"))}): Better Auth is the default identity and session engine; the configured web BFF enforces session and workspace authorization.`,
    `- [API authorization](${link(localePath(DEFAULT_LOCALE, "/docs/reference/api-routes"))}): versioned routes accept an authenticated session or scoped API key; the MCP endpoint is bearer-key only.`,
    `- [Database and workspace access](${link(localePath(DEFAULT_LOCALE, "/docs/web/database"))}): derive workspace access from the authenticated caller and verify membership on every user-owned read and write.`,
    `- [Supabase RLS](${link(localePath(DEFAULT_LOCALE, "/docs/deploy/supabase-cloud"))}): review RLS and grants for tables exposed through PostgREST; this database boundary is separate from BFF authorization.`,
    `- [Logging and audit](${link(localePath(DEFAULT_LOCALE, "/docs/modules/observability"))}): use static messages and redacted structured context, preserve safe correlation/workspace identifiers, and keep privileged changes auditable.`,
  );

  lines.push("", "## Reference", "");
  for (const entry of REFERENCE_LINKS) {
    lines.push(`- [${inline(entry.label)}](${link(entry.path)}): ${inline(entry.description)}`);
  }

  return `${lines.join("\n")}\n`;
}
