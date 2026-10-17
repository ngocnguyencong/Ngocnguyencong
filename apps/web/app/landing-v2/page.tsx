import { getDictionary } from "@supastack/i18n";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreditCard, Palette, ShieldCheck, Sparkles, Workflow } from "lucide-react";

import { CtaBand } from "../../src/kit/blocks/marketing/cta-band";
import { FaqAccordion } from "../../src/kit/blocks/marketing/faq-accordion";
import { FeatureRows } from "../../src/kit/blocks/marketing/feature-rows";
import { FeatureTabs } from "../../src/kit/blocks/marketing/feature-tabs";
import { HeroSplit } from "../../src/kit/blocks/marketing/hero-split";
import { PricingCards } from "../../src/kit/blocks/marketing/pricing-cards";
import { ProductFrame } from "../../src/kit/blocks/marketing/product-frame";
import { ScrollReveal } from "../../src/kit/blocks/marketing/scroll-reveal";
import styles from "../../src/landing-page.module.css";
import { marketingFontClassName } from "../../src/marketing/fonts";
import { HomeShell } from "../../src/marketing/home-shell";
import { SiteFooter } from "../../src/marketing/site-footer";
import { SiteHeader } from "../../src/marketing/site-header";
import { siteConfig } from "../../src/marketing/site-config";
import marketing from "../../src/marketing/marketing.module.css";

export const metadata: Metadata = {
  title: "Landing preview (v2)",
  robots: { index: false, follow: false },
};

const FEATURE_TABS = [
  {
    description:
      "Choose an auth engine and configure the sign-in methods your application needs. Personal and organization workspaces share the same membership boundary.",
    icon: <ShieldCheck />,
    id: "auth",
    label: "Sign-in",
    points: [
      "Better Auth or Auth.js as the engine",
      "Email codes, magic links, OAuth, and passwords",
      "Owner, admin, and member roles per workspace",
    ],
    title: "Identity and workspaces",
  },
  {
    description:
      "Explore example plans and paid-feature gates. Connect a billing provider when you are ready to accept payments.",
    icon: <CreditCard />,
    id: "billing",
    label: "Billing",
    points: [
      "Entitlement checks gate paid features",
      "Provider adapters handle checkout and webhooks",
      "The sample tiers below are illustrative",
    ],
    title: "Billing and entitlements",
  },
  {
    description:
      "Test the sample AI flow with a local adapter, then configure providers, workspace budgets, and key management.",
    icon: <Sparkles />,
    id: "ai",
    label: "AI module",
    points: [
      "Deterministic local adapter for development",
      "Provider credentials stay server-only",
      "Per-workspace usage budgets",
    ],
    title: "AI with controls",
  },
  {
    description:
      "Run sample background tasks and preview transactional messages. Add a job runtime and an email transport for your deployment.",
    icon: <Workflow />,
    id: "jobs",
    label: "Jobs & email",
    points: [
      "Enqueue, status, and cancel through the shared job runner",
      "Recurring work on persisted schedules",
      "A local outbox previews every template",
    ],
    title: "Background jobs and email",
  },
  {
    description:
      "Color packs plus density, radius, and font presets restyle every surface. Compose pages from the kit block library.",
    icon: <Palette />,
    id: "themes",
    label: "Themes",
    points: [
      "Packs apply through a data-theme attribute",
      "Marketing, app, and chrome block surfaces",
      "Token-only blocks restyle for free",
    ],
    title: "Packs, presets, and blocks",
  },
] as const;

function ModuleVignette({ rows }: { rows: readonly { title: string; hint: string }[] }) {
  return (
    <div>
      {rows.map((row) => (
        <div
          key={row.title}
          style={{
            alignItems: "center",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            gap: 12,
            padding: "13px 18px",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              background: "var(--border)",
              borderRadius: 999,
              flexShrink: 0,
              height: 30,
              width: 30,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{row.title}</div>
            <div style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{row.hint}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Alternate landing preview — dev-only. Composes a different arrangement of
 * kit blocks than the default landing (split hero instead of centered,
 * feature-tabs + feature-rows instead of the grid) so the owner can compare
 * compositions before choosing. Production requests 404 like /kit-blocks.
 */
export default function LandingV2Page() {
  if (process.env.NODE_ENV !== "development") notFound();

  const copy = getDictionary("en").marketingLanding;

  return (
    <HomeShell className={`marketing-theme ${marketing.home} ${marketingFontClassName}`}>
      <a className={marketing.skip} href="#main">
        Skip to content
      </a>
      <SiteHeader />
      <main className={marketing.main} id="main">
        <HeroSplit
          kicker={copy.metadataTitle}
          lede={copy.description}
          media={
            <ProductFrame url="app.example.test">
              <ModuleVignette
                rows={[
                  { hint: "Members, roles, and invitations", title: "Workspace" },
                  { hint: "Plans, checkout, and entitlements", title: "Billing" },
                  { hint: "Sample flow with a local adapter", title: "AI task" },
                ]}
              />
            </ProductFrame>
          }
          primary={{ href: "/auth", label: copy.primaryAction }}
          proof="Sample modules on deterministic local adapters — no credentials needed"
          secondary={{ href: "/docs", label: "Read the docs" }}
          title={copy.title}
        />
        <div className={styles.anchor} id="features">
          <ScrollReveal>
            <FeatureTabs
              heading="Example modules"
              items={FEATURE_TABS}
              sub="Each module is a working sample — open a tab to see what it covers."
            />
          </ScrollReveal>
        </div>
        <ScrollReveal>
          <FeatureRows
            items={[
              {
                bullets: [
                  { text: "App Router pages compose the shared modules.", title: "Next.js" },
                  { text: "iOS and Android samples use the same API.", title: "Expo clients" },
                  { text: "The desktop shell loads the web app.", title: "Tauri shell" },
                ],
                description:
                  "One codebase ships every client. The repository keeps platform surfaces in sync through shared packages.",
                eyebrow: "Platforms",
                media: (
                  <ProductFrame url="app.example.test/chat">
                    <ModuleVignette
                      rows={[
                        { hint: "Threaded sample conversation", title: "Chat" },
                        { hint: "Queued jobs on persisted schedules", title: "Schedules" },
                      ]}
                    />
                  </ProductFrame>
                ),
                title: "Web, mobile, and desktop",
              },
              {
                bullets: [
                  { text: "Workspace-scoped history of member actions.", title: "Audit records" },
                  { text: "Service status for the running stack.", title: "Health snapshot" },
                ],
                description:
                  "Inspect sample activity, service health, and workspace audit records while developing your application.",
                eyebrow: "Operations",
                media: (
                  <ProductFrame url="app.example.test/admin">
                    <ModuleVignette
                      rows={[
                        { hint: "workspaceId-scoped member events", title: "Audit log" },
                        { hint: "Latency and status per service", title: "Health" },
                      ]}
                    />
                  </ProductFrame>
                ),
                title: "Audit and observability",
              },
            ]}
          />
        </ScrollReveal>
        <div className={styles.anchor} id="pricing">
          <ScrollReveal>
            <PricingCards
              heading="Sample pricing"
              sub="Illustrative prices for the demo. Replace these plans with your product’s billing catalog."
              tiers={[
                {
                  cta: { href: "/auth", label: "Try the demo" },
                  description: "An example entry plan for an individual workspace.",
                  features: ["Personal workspace", "Sample workflows", "Account settings"],
                  name: "Basic",
                  price: "$0",
                },
                {
                  cta: { href: "/auth", label: "Try the demo" },
                  description: "An example plan for a workspace with several members.",
                  features: ["Shared workspace", "Member invitations", "Role management"],
                  name: "Team",
                  period: "month",
                  price: "$19",
                  recommended: true,
                },
                {
                  cta: { href: "/auth", label: "Try the demo" },
                  description: "An example plan for additional workspace controls.",
                  features: ["Usage budgets", "Audit records", "API access"],
                  name: "Business",
                  period: "month",
                  price: "$49",
                },
              ]}
            />
          </ScrollReveal>
        </div>
        <div className={styles.anchor} id="faq">
          <ScrollReveal>
            <FaqAccordion items={siteConfig.faq} />
          </ScrollReveal>
        </div>
        <ScrollReveal>
          <CtaBand
            cta={{ href: "/docs", label: "Read the setup guide" }}
            text="Compose pages from the kit blocks, swap the copy, and connect the services your application uses."
            title="Make this demo your own."
          />
        </ScrollReveal>
      </main>
      <SiteFooter />
    </HomeShell>
  );
}
