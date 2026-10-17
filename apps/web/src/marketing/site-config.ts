export type MarketingLink = {
  href: string;
  label: string;
};

export type MarketingSection =
  | "blog"
  | "docs"
  | "pricing"
  | "faq"
  | "contact"
  | "privacy"
  | "terms"
  | "license"
  | "acceptable-use"
  | "disclaimer"
  | "showcase"
  | "changelog"
  | "roadmap"
  | "api-reference";

export type FaqItem = {
  question: string;
  answer: string;
};

export type SiteConfig = {
  brandName: "supastack";
  tagline: string;
  signInUrl?: string;
  docsUrl?: string;
  repositoryUrl?: string;
  navigation: readonly MarketingLink[];
  footerLinks: readonly MarketingLink[];
  /** Secondary public resources — rendered as their own footer nav group. */
  resourceLinks: readonly MarketingLink[];
  faqHeading: string;
  faq: readonly FaqItem[];
};

export const siteConfig: SiteConfig = {
  brandName: "supastack",
  tagline: "A boilerplate demo for web, mobile, and desktop.",
  signInUrl: "/auth",
  navigation: [
    { href: "/#pricing", label: "Pricing" },
    { href: "/#waitlist", label: "Waitlist" },
    { href: "/faq", label: "FAQ" },
    { href: "/blog", label: "Blog" },
    { href: "/docs", label: "Docs" },
  ],
  footerLinks: [
    { href: "/showcase", label: "Showcase" },
    { href: "/contact", label: "Contact" },
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
    { href: "/legal/acceptable-use", label: "Acceptable use" },
    { href: "/legal/disclaimer", label: "Disclaimer" },
    { href: "/legal/license", label: "License" },
  ],
  resourceLinks: [
    { href: "/changelog", label: "Changelog" },
    { href: "/roadmap", label: "Roadmap" },
    { href: "/api-reference", label: "API reference" },
  ],
  faqHeading: "About this demo",
  faq: [
    {
      question: "What does this demo show?",
      answer:
        "supastack is the sample brand for this boilerplate. The demo lets you explore application modules and page templates before adapting them to your own product.",
    },
    {
      question: "Which apps are included?",
      answer:
        "The repository includes a Next.js web app, Expo mobile clients for iOS and Android, and a Tauri desktop shell that loads the web app. Shared packages supply common application behavior.",
    },
    {
      question: "Can I try it without provider credentials?",
      answer:
        "The local demo uses deterministic adapters for the sample workflows. Follow the setup guide to configure a database and real services for your application.",
    },
    {
      question: "Are these actual subscription offers?",
      answer:
        "No. These are illustrative prices and plan descriptions for a sample pricing section. Replace them with your own billing catalog and a provider such as Stripe.",
    },
    {
      question: "Where do I change the sample content?",
      answer:
        "Edit the landing page, site configuration, and locale dictionaries to set your product name and copy. The kit block library provides reusable sections for composing your pages.",
    },
    {
      question: "How do I configure sign-in?",
      answer:
        "Choose Better Auth or Auth.js and configure the sign-in methods your product needs. The authentication guides explain email codes, magic links, OAuth, passwords, and account security.",
    },
    {
      question: "How is workspace data separated?",
      answer:
        "Application records belong to a workspaceId. Personal and organization workspaces use the same boundary for membership, billing access, AI usage, and audit history.",
    },
    {
      question: "What can I use for background tasks?",
      answer:
        "Use the local job adapter for development or configure Trigger.dev. The shared JobRunner supports enqueue, status, and cancel; Trigger.dev-specific workflow behavior remains explicit. Recurring tasks use persisted schedules.",
    },
    {
      question: "How do I test application email?",
      answer:
        "Preview transactional templates with the local transport, then configure an email provider for delivery. Marketing campaigns and cold outreach belong in a separate system.",
    },
    {
      question: "How do I add payments to the mobile app?",
      answer:
        "Configure RevenueCat for native purchase and restore flows. The server verifies store access before updating workspace entitlements, and purchase management requires an owner or admin. Configure web billing separately with its own provider.",
    },
    {
      question: "How should I configure AI credentials?",
      answer:
        "Set platform credentials on the server or enable encrypted workspace keys. Provider secrets must stay out of client bundles and logs; configure usage budgets for each workspace.",
    },
  ],
};

/**
 * `aria-current` predicate shared by header/footer navs. An internal href is
 * "current" when it matches `/${active}` exactly or ends with that segment —
 * so `active="license"` highlights `/legal/license`. External URLs never
 * qualify (they don't start with "/").
 */
export function isActiveSection(href: string, active?: MarketingSection): boolean {
  return active !== undefined && href.startsWith("/") && href.endsWith(`/${active}`);
}

export function optionalExternalLinks(config: SiteConfig): MarketingLink[] {
  const links: MarketingLink[] = [];
  if (config.docsUrl) {
    links.push({ href: config.docsUrl, label: "Documentation" });
  }
  if (config.repositoryUrl) {
    links.push({ href: config.repositoryUrl, label: "Repository" });
  }
  if (config.signInUrl) {
    links.push({ href: config.signInUrl, label: "Sign in" });
  }
  return links.filter((link) => link.href.length > 0 && link.href !== "#");
}
