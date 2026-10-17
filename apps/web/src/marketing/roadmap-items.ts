export type RoadmapStatus = "planned" | "in_progress" | "shipped";

export type RoadmapItem = {
  title: string;
  description: string;
  status: RoadmapStatus;
};

/**
 * Curated public roadmap for the boilerplate demo. Items stay neutral — no
 * promised dates, no workspace feature-request rows (that board is private
 * member data; the page links to /feedback instead of reading it). Products
 * replace this list with their own plans.
 */
export const roadmapItems: readonly RoadmapItem[] = [
  {
    title: "Multi-provider billing",
    description:
      "Checkout, customer portal, and signed webhooks behind one provider adapter contract.",
    status: "shipped",
  },
  {
    title: "Theme and layout library",
    description:
      "21 color packs, 17 design styles, and four app layouts selectable with a one-line default.",
    status: "shipped",
  },
  {
    title: "Workspace CMS and commerce",
    description: "Content entries, products, and orders scoped to the workspace boundary.",
    status: "shipped",
  },
  {
    title: "Public REST API and MCP endpoint",
    description: "A versioned REST surface with a generated OpenAPI document and scoped API keys.",
    status: "shipped",
  },
  {
    title: "In-app notification center",
    description: "Workspace events listed in the app with optional email delivery per category.",
    status: "shipped",
  },
  {
    title: "Feature-tabs marketing block",
    description:
      "An interactive, keyboard-complete tabbed feature tour joins the copyable block library.",
    status: "shipped",
  },
  {
    title: "Public trust pages",
    description:
      "A public changelog, curated roadmap, and API reference describe shipped capabilities and endpoints without sign-in.",
    status: "shipped",
  },
  {
    title: "Guided setup CLI",
    description:
      "`pnpm setup` walks a fresh checkout through environment checks, configuration, and optional migrations.",
    status: "shipped",
  },
  {
    title: "Prepaid workspace credits",
    description:
      "A consumable credit balance keeps metered workspace actions running after the plan's monthly quota is used up.",
    status: "shipped",
  },
  {
    title: "Mobile push notifications",
    description:
      "Device tokens and delivery for workspace events — notification taps deep-link into the right screen, with optional authenticated Expo sends.",
    status: "shipped",
  },
  {
    title: "Mobile content and commerce",
    description:
      "CMS entries, products, and orders managed from the mobile app over the same workspace-scoped APIs.",
    status: "shipped",
  },
  {
    title: "Mobile account data export",
    description: "Members download a copy of their personal data straight from the mobile app.",
    status: "shipped",
  },
  {
    title: "Desktop auto-update and launch at login",
    description:
      "The desktop shell checks for updates in the background, installs them on confirmation, and can start automatically at sign-in.",
    status: "shipped",
  },
  {
    title: "Site analytics",
    description:
      "Consent-gated traffic analytics — first-party collection or a hosted provider behind one setting, with an admin summary.",
    status: "shipped",
  },
  {
    title: "Expanded AI workflows",
    description: "Budgeted multi-step agent runs against the workspace model catalog.",
    status: "in_progress",
  },
  {
    title: "More kit blocks",
    description: "Additional copyable sections for marketing pages and application screens.",
    status: "in_progress",
  },
  {
    title: "Deeper provider guides",
    description: "More setup and operations walkthroughs for each integration point.",
    status: "in_progress",
  },
  {
    title: "Additional storage adapters",
    description: "More object-storage backends behind the workspace file contract.",
    status: "planned",
  },
  {
    title: "Desktop distribution polish",
    description: "Signed, notarized installers and release automation for the desktop shell.",
    status: "in_progress",
  },
  {
    title: "Mobile receipt reconciliation",
    description:
      "A scheduled pass reconciles Expo delivery receipts so stale device tokens get pruned.",
    status: "shipped",
  },
  {
    title: "Passkey and biometric sign-in",
    description:
      "WebAuthn passkeys on web and device biometrics on mobile as first-class sign-in options.",
    status: "planned",
  },
  {
    title: "Mobile offline reads",
    description:
      "Recently loaded workspace data stays readable in the mobile app without a connection.",
    status: "shipped",
  },
  {
    title: "Desktop update channels",
    description: "Stable and beta update feeds for the desktop shell so teams can stage releases.",
    status: "shipped",
  },
  {
    title: "Localized application UI",
    description:
      "The workspace app and mobile app follow the visitor's locale the way the public site already does.",
    status: "planned",
  },
  {
    title: "Workspace data portability",
    description:
      "Admins export a full copy of workspace content, commerce, and settings for migration or backup.",
    status: "shipped",
  },
  {
    title: "Usage-based billing reporting",
    description:
      "Metered workspace usage reports back to the billing provider for consumption-priced plans.",
    status: "planned",
  },
];

export const ROADMAP_STATUS_ORDER = ["shipped", "in_progress", "planned"] as const;

export const ROADMAP_STATUS_LABELS: Record<RoadmapStatus, string> = {
  shipped: "Shipped",
  in_progress: "In progress",
  planned: "Planned",
};

export function groupRoadmapItems(
  items: readonly RoadmapItem[],
): { status: RoadmapStatus; label: string; items: RoadmapItem[] }[] {
  return ROADMAP_STATUS_ORDER.map((status) => ({
    status,
    label: ROADMAP_STATUS_LABELS[status],
    items: items.filter((item) => item.status === status),
  })).filter((group) => group.items.length > 0);
}
