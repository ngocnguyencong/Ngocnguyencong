import type { AppLocale } from "@supastack/i18n";

/**
 * Page-level entry shape for `/changelog` — deliberately named
 * `MarketingChangelogEntry` so it never collides with the `ChangelogEntry`
 * render-props type exported by the `changelog-timeline` kit block (different
 * shape: `date/title/points` data vs `meta/title/points` block props).
 */
export type MarketingChangelogEntry = {
  /** Ship date, ISO `YYYY-MM-DD`. Unique — entries stay newest first. */
  date: string;
  /** Release headline. */
  title: string;
  /** Outcome bullets — one shipped capability each, no internals. */
  points: readonly string[];
};

/**
 * Public changelog for the boilerplate demo. Copy describes outcomes a buyer
 * can verify in the product — never implementation internals, root causes,
 * or third-party product names. Products building on the kit replace this
 * list with their own release notes.
 */
export const changelogEntries: readonly MarketingChangelogEntry[] = [
  {
    date: "2026-10-16",
    title: "A ready-to-build kit: setup checklist, usage limits, offline mobile, and new styles",
    points: [
      "Walk any new project through an in-app setup checklist that shows what is configured, what runs in demo mode, and what to do next.",
      "Set a monthly AI budget and usage caps for each workspace from the new Usage settings, with current usage visible on web and mobile.",
      "Owners and admins can download a full copy of a workspace's content, commerce, members, and settings.",
      "The analytics dashboard shows trends against the previous period, a live visitor count, and layouts that fit every screen size.",
      "Choose from five new color packs and five matching design styles.",
      "Recently viewed mobile screens stay readable offline, with a note showing when the data was saved.",
      "Desktop apps can offer a beta update channel alongside stable releases.",
      "Mobile devices that no longer accept notifications drop out of push delivery automatically.",
      "Fixed: the site header shows the right account button as soon as a page loads.",
    ],
  },
  {
    date: "2026-10-13",
    title: "The AI task console gets its own address, and every platform catches up",
    points: [
      "The AI task console lives at its own /ai route — the durable task flow and the no-database local demo share one dedicated address in every app language.",
      "The 'AI task' navigation link lands directly on the task console instead of a dashboard anchor that did not exist in the default language.",
      "The /dashboard address consistently opens the analytics product in every app language, and shared task-recovery links and AI budget-exceeded notifications land on the task console.",
      "Settings pages in every app language load the developer tools — API keys, schedules, and webhooks — plus the audit log and the active-sessions list.",
      "Admin navigation no longer links to a section that does not exist.",
      "The mobile app can pause and resume scheduled jobs, rename or delete chat threads, and shows webhook delivery history; the desktop app gains a native Edit menu with standard text shortcuts and keeps the window zoom level across restarts.",
      "The mobile app also edits the profile name under Settings → General, creates API keys with an expiry — every key row shows created, last-used, and expiry details — and edits content entries including their body text.",
    ],
  },
  {
    date: "2026-10-11",
    title: "Prepaid credits, push notifications, and privacy-first analytics",
    points: [
      "Workspaces can hold a prepaid credit balance that AI tasks spend automatically when the plan's monthly quota runs out, so paid bursts keep working instead of failing.",
      "Billing lifecycle events and platform admins grant credits, and a billing settings card shows the balance and recent ledger on web and mobile.",
      "The mobile app registers for push notifications after sign-in, and workspace notifications can arrive on members' devices through the native push channel.",
      "Site analytics can be off, privacy-friendly first-party collection, or a hosted provider through one setting — gated behind visitor consent, with an admin summary for the first-party store.",
    ],
  },
  {
    date: "2026-10-10",
    title: "Public trust pages and a guided first run",
    points: [
      "Three new public pages — a changelog, a what's-planned-next board, and an API reference — keep shipped capabilities, plans, and endpoints visible without sign-in.",
      "The API reference renders its endpoint list from the same OpenAPI document the API serves, so it stays accurate as routes change.",
      "A new `pnpm setup` command walks a fresh checkout through environment checks, configuration, and optional migrations; a `--check` mode validates a machine noninteractively.",
      "A reusable feature-tabs marketing block joins the kit library — each capability reveals a headline, points, and a visual, works fully by keyboard, and stays readable without JavaScript.",
    ],
  },
  {
    date: "2026-10-09",
    title: "End-of-page follow-up and footer controls",
    points: [
      "A scroll-end call-to-action block joins the marketing kit — a once-per-session dialog that opens when a reader reaches the bottom of the page.",
      "The site footer now hosts a theme menu and a language switcher, so visitors can restyle the site or change locale from any public page.",
      "Landing sections animate in once as they scroll into view, with content fully visible when reduced motion is preferred or scripts do not run.",
    ],
  },
  {
    date: "2026-10-07",
    title: "A bigger design system for the kit",
    points: [
      "The theme library grows to 21 color packs and 17 curated design styles, selectable with a one-line default and previewed under Appearance.",
      "Four app layouts — sidebar, top navigation, focused, and a collapsible icon rail — share the same navigation and workspace switching.",
      "The copyable block library reaches marketing, app, and site-chrome surfaces, browsable live in the block gallery.",
    ],
  },
  {
    date: "2026-10-06",
    title: "An agent index for every site",
    points: [
      "Each deployment serves a /llms.txt index that lists its documentation, public pages, and machine-readable endpoints for AI agents.",
      "A guided setup runbook walks a fresh checkout all the way to a deployed application.",
    ],
  },
  {
    date: "2026-10-03",
    title: "Cron schedules and budgeted agent runs",
    points: [
      "Recurring schedules now count the occurrences that elapsed while no tick ran, so missed work is reported instead of silently skipped.",
      "A worked example shows a multi-step agent run reserving workspace AI budget before execution and settling the real cost afterward.",
    ],
  },
  {
    date: "2026-10-01",
    title: "Native purchases and desktop deep links",
    points: [
      "The mobile app completes store purchases and restores them through server-verified workspace entitlements.",
      "The desktop shell handles deep links, restores window state, and shows an offline banner when the app is unreachable.",
      "Documentation grows to beginner-level guides covering every module, provider, and platform path.",
    ],
  },
  {
    date: "2026-09-29",
    title: "Observability across tasks, jobs, and webhooks",
    points: [
      "AI tasks, billing webhooks, and scheduled jobs share one correlation identifier across logs, events, and the delivery ledger.",
      "An optional alert destination reports failed jobs and terminally failed webhook deliveries.",
      "Duration metrics record how long tasks and recurring jobs take.",
    ],
  },
  {
    date: "2026-09-28",
    title: "The full mobile app surface",
    points: [
      "The mobile app ships tabs, streaming chat, settings sections, and organization management end to end.",
      "A dedicated mobile API surface serves organization and developer features to signed-in clients.",
    ],
  },
  {
    date: "2026-09-27",
    title: "Weekly digest, tiered content, and legal pages",
    points: [
      "Workspaces can schedule recurring jobs — the shipped example emails a weekly digest of new content to members.",
      "CMS entries can require a minimum subscription tier before the body is readable.",
      "The public site gains acceptable-use, disclaimer, and license pages.",
    ],
  },
  {
    date: "2026-09-24",
    title: "Durable scheduling, connected accounts, more billing",
    points: [
      "Persisted cron schedules are claimed from the database, so recurring work survives restarts on every deployment shape.",
      "Workspaces connect provider accounts and send mail through their own SMTP mailboxes from Settings → Connections.",
      "The billing adapter catalog grows with additional checkout providers behind the same contract.",
      "Per-workspace usage quotas cap metered consumption.",
    ],
  },
  {
    date: "2026-09-23",
    title: "MCP server, custom domains, and public API docs",
    points: [
      "A streamable HTTP MCP endpoint exposes workspace tools to scoped API keys — the same credentials that power the REST surface.",
      "Workspaces can serve the application on their own verified hostnames.",
      "The versioned REST API publishes a generated OpenAPI document and a hosted reference UI.",
      "A platform-funded public AI option lets visitors try the product with a capped daily spend.",
    ],
  },
  {
    date: "2026-09-22",
    title: "Workspace CMS, commerce, and the feature board",
    points: [
      "A workspace CMS drafts, publishes, and archives content entries; commerce tracks products and orders under the same boundary.",
      "Members submit and vote on feature requests in the in-app feedback board.",
      "Waitlist, early-access codes, and referral records support invite-only growth flows.",
    ],
  },
  {
    date: "2026-09-15",
    title: "Notification center, chat, and workspace switching",
    points: [
      "An in-app notification center lists workspace events with optional email delivery for each category.",
      "Chat streams responses into persisted threads.",
      "Members switch between personal and organization workspaces, send invites, and manage roles.",
    ],
  },
];

/** `Intl.DateTimeFormat` tags per app locale — BCP-47, not og underscores. */
const INTL_DATE_LOCALES: Record<AppLocale, string> = {
  en: "en-US",
  de: "de-DE",
  es: "es-ES",
  fr: "fr-FR",
};

/** Display format for entry dates — localized, UTC-stable ("October 9, 2026"). */
export function formatChangelogDate(date: string, locale: AppLocale = "en"): string {
  return new Intl.DateTimeFormat(INTL_DATE_LOCALES[locale], {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
