import { notFound } from "next/navigation";
import { BookOpen, CreditCard, Inbox, ShieldCheck, Sparkles, UserRound, Zap } from "lucide-react";

import { KIT_BLOCKS } from "../../src/kit/blocks";
import { AmbientBackground } from "../../src/kit/blocks/marketing/ambient-background";
import { ChangelogTimeline } from "../../src/kit/blocks/marketing/changelog-timeline";
import { ChartLine } from "../../src/kit/blocks/marketing/chart-line";
import { CtaBand } from "../../src/kit/blocks/marketing/cta-band";
import { FaqAccordion } from "../../src/kit/blocks/marketing/faq-accordion";
import { FeatureGrid } from "../../src/kit/blocks/marketing/feature-grid";
import { FeatureRows } from "../../src/kit/blocks/marketing/feature-rows";
import { FeatureSpotlight } from "../../src/kit/blocks/marketing/feature-spotlight";
import { FeatureTabs } from "../../src/kit/blocks/marketing/feature-tabs";
import { HeroCentered } from "../../src/kit/blocks/marketing/hero-centered";
import { HeroSplit } from "../../src/kit/blocks/marketing/hero-split";
import { LogoStrip } from "../../src/kit/blocks/marketing/logo-strip";
import { NewsletterBand } from "../../src/kit/blocks/marketing/newsletter-band";
import { WaitlistBand } from "../../src/kit/blocks/marketing/waitlist-band";
import { PricingCards } from "../../src/kit/blocks/marketing/pricing-cards";
import { ProductGrid } from "../../src/kit/blocks/marketing/product-grid";
import { ScrollEndCta } from "../../src/kit/blocks/marketing/scroll-end-cta";
import { ScrollReveal } from "../../src/kit/blocks/marketing/scroll-reveal";
import { SectionHeader } from "../../src/kit/blocks/marketing/section-header";
import { TestimonialGrid } from "../../src/kit/blocks/marketing/testimonial-grid";
import { ProsePage } from "../../src/kit/blocks/chrome/prose-page";
import { SiteFooter } from "../../src/kit/blocks/chrome/site-footer";
import { SiteHeader } from "../../src/kit/blocks/chrome/site-header";
import { ChoicePills } from "../../src/kit/blocks/app/choice-pills";
import { DataTable } from "../../src/kit/blocks/app/data-table";
import { DataVizBars } from "../../src/kit/blocks/app/data-viz-bars";
import { DataVizDonut } from "../../src/kit/blocks/app/data-viz-donut";
import { EmptyState } from "../../src/kit/blocks/app/empty-state";
import { MetricTrend } from "../../src/kit/blocks/app/metric-trend";
import { OtpInput } from "../../src/kit/blocks/app/otp-input";
import { PaywallGate } from "../../src/kit/blocks/app/paywall-gate";
import { StatGrid } from "../../src/kit/blocks/app/stat-grid";
import { Tooltip } from "../../src/kit/blocks/app/tooltip";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, resolveLocale } from "@supastack/i18n";
import { LanguageSwitcher } from "../../src/i18n/language-switcher";
import { FoundationPreview } from "../../src/theme/foundation-preview";
import { ThemeMenu } from "../../src/theme/theme-menu";
import styles from "./kit-blocks.module.css";
import { MINIMAL_DEMOS, MinimalShowcase } from "./minimal-showcase";

const COMPOSED_FOUNDATION_BLOCKS = new Set(["master-detail", "table-toolbar", "pagination"]);

/**
 * Kit block library — dev-only browser for the copyable blocks in src/kit/blocks/.
 * Marketing cells render on a .marketing-theme wrapper with
 * [data-marketing-theme="inherit"], so they follow the visitor's pack pick and
 * demo the subtree theming used by marketing-theme.ts. App cells use .app-theme.
 */
export default async function KitBlocksPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  const locale = resolveLocale([(await cookies()).get(LOCALE_COOKIE)?.value]);
  return (
    <div className={`app-theme ${styles.page}`}>
      <header className={styles.header}>
        <h1>Kit blocks</h1>
        <p>
          Copyable, token-native sections from <code>src/kit/blocks/</code>. Copy a block's{" "}
          <code>.tsx</code> + <code>.module.css</code> into your product and rewrite the copy — it
          restyles with every pack, preset, and layout. Switch axes in Settings → Appearance and
          this page live-updates.
        </p>
      </header>

      <section className={styles.group}>
        <h2 className={styles.groupTitle}>Minimal style</h2>
        <p className={styles.showcaseNote}>
          One composed landing on the <code>minimal</code> pack (the <code>minimal-product</code>{" "}
          style): hero-product → steps-ruled → feature-story → comparison-ruled → pricing-panel →
          faq-split → cta-form. Flat surfaces, hairline structure, pill actions — the product window
          is the only elevated object.
        </p>
        <div className={`marketing-theme ${styles.showcaseFrame}`} data-theme="minimal">
          <MinimalShowcase />
        </div>
      </section>

      {(["marketing", "app", "chrome"] as const).map((surface) => (
        <section className={styles.group} key={surface}>
          <h2 className={styles.groupTitle}>
            {surface === "marketing"
              ? "Marketing blocks"
              : surface === "app"
                ? "App blocks"
                : "Site chrome blocks"}
          </h2>
          {surface === "app" ? (
            <article className={styles.blockCard}>
              <div className="app-theme">
                <FoundationPreview locale={locale} />
              </div>
            </article>
          ) : null}
          {KIT_BLOCKS.filter(
            (block) =>
              block.surface === surface &&
              !(surface === "app" && COMPOSED_FOUNDATION_BLOCKS.has(block.id)),
          ).map((block) => (
            <article className={styles.blockCard} key={block.id}>
              <header className={styles.blockHeader}>
                <div>
                  <h3 className={styles.blockName}>{block.name}</h3>
                  <p className={styles.blockDesc}>{block.description}</p>
                </div>
                <code className={styles.blockPath}>src/kit/blocks/{surface}/</code>
              </header>
              <div
                className={surface === "app" ? "app-theme" : "marketing-theme"}
                {...(surface === "app" ? {} : { "data-marketing-theme": "inherit" })}
              >
                {block.id === "hero-centered" ? (
                  <HeroCentered
                    accent="that converts."
                    kicker="Now in early access"
                    lede="One line that says what the product does and who it is for — swap in your own."
                    primary={{ href: "#", label: "Get started" }}
                    secondary={{ href: "#", label: "See how it works" }}
                    title="A headline worth reading"
                  />
                ) : null}
                {block.id === "feature-grid" ? (
                  <FeatureGrid
                    heading="Everything you need, nothing you don't"
                    items={[
                      {
                        description:
                          "Ship the boring parts fast and spend your time on the product.",
                        icon: <Zap />,
                        title: "Fast by default",
                      },
                      {
                        description: "Tokens, blocks, and styles your agent can extend safely.",
                        icon: <BookOpen />,
                        title: "Agent-ready",
                      },
                      {
                        description: "Packs and presets restyle every block without rewrites.",
                        icon: <Sparkles />,
                        title: "Themeable",
                      },
                    ]}
                    sub="Three to six short reasons your product is worth trying."
                  />
                ) : null}
                {block.id === "pricing-cards" ? (
                  <PricingCards
                    heading="Simple pricing"
                    sub="One recommended tier, honest limits."
                    tiers={[
                      {
                        cta: { href: "#", label: "Start free" },
                        description: "For trying things out.",
                        features: ["1 project", "Community support", "Core blocks"],
                        name: "Starter",
                        price: "$0",
                      },
                      {
                        cta: { href: "#", label: "Go Pro" },
                        description: "For products in production.",
                        features: ["Unlimited projects", "Priority support", "All blocks"],
                        name: "Pro",
                        period: "mo",
                        price: "$29",
                        recommended: true,
                      },
                      {
                        cta: { href: "#", label: "Talk to us" },
                        description: "For teams and agencies.",
                        features: ["SSO", "SLA", "Dedicated support"],
                        name: "Team",
                        period: "mo",
                        price: "$99",
                      },
                    ]}
                  />
                ) : null}
                {block.id === "hero-split" ? (
                  <HeroSplit
                    accent="worth a second look."
                    kicker="For teams that ship"
                    lede="Copy on the left, a real product preview on the right — the layout most SaaS homepages actually use."
                    media={
                      <div
                        style={{
                          aspectRatio: "4 / 3",
                          background: "var(--raised)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-surface, 22px)",
                        }}
                      />
                    }
                    primary={{ href: "#", label: "Start building" }}
                    proof="No credit card required"
                    secondary={{ href: "#", label: "Watch the demo" }}
                    title="A product story"
                  />
                ) : null}
                {block.id === "section-header" ? (
                  <div className={styles.blockPad}>
                    <SectionHeader
                      eyebrow="Why us"
                      sub="A supporting sentence that earns its place under the title."
                      title="A section that needs an introduction"
                    />
                  </div>
                ) : null}
                {block.id === "feature-rows" ? (
                  <FeatureRows
                    items={[
                      {
                        description:
                          "One idea per row, media on alternating sides, bullets when they help.",
                        eyebrow: "Workflow",
                        title: "Tell the product story in chapters",
                      },
                      {
                        bullets: [
                          {
                            title: "Keeps rhythm",
                            text: "Alternation avoids the wall-of-cards look.",
                          },
                          { title: "Media slot", text: "Drop real screenshots, not placeholders." },
                        ],
                        description: "Bullets carry the details when a paragraph is not enough.",
                        eyebrow: "Details",
                        title: "Second row flips the composition",
                      },
                    ]}
                  />
                ) : null}
                {block.id === "feature-spotlight" ? (
                  <FeatureSpotlight
                    description="Focused copy beside the real interface — the section does the convincing, not a wall of cards."
                    eyebrow="Product"
                    heading="One feature, told properly"
                    media={
                      <div
                        style={{
                          aspectRatio: "4 / 3",
                          background: "var(--raised)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-surface, 22px)",
                        }}
                      />
                    }
                    minis={[
                      {
                        body: "Mini points sit on the page — no card boxes around plain text.",
                        icon: <Zap />,
                        title: "Container-free",
                      },
                      {
                        body: "The panel shows product, not a grey placeholder.",
                        icon: <BookOpen />,
                        title: "Real media",
                      },
                      {
                        body: "Pass ordered when the minis are a real sequence of steps.",
                        icon: <Sparkles />,
                        title: "Sequence-ready",
                      },
                    ]}
                    sub="A supporting sentence that earns its place under the title."
                    support="A quieter second line for context that helps but shouldn't headline."
                    title="The story behind the screenshot"
                  />
                ) : null}
                {block.id === "feature-tabs" ? (
                  <FeatureTabs
                    heading="A tour of the product"
                    items={[
                      {
                        description:
                          "Each capability gets a panel with a headline, a short description, bullet points, and a visual slot.",
                        icon: <ShieldCheck />,
                        id: "one",
                        label: "Capability one",
                        points: [
                          "Arrow keys, Home, and End move between tabs",
                          "The selected tab keeps the only tab stop",
                          "Every panel renders — no-JS readers get all copy",
                        ],
                        title: "A headline for the first panel",
                      },
                      {
                        description:
                          "Swap in a real screenshot or product markup via the media slot — the default is a quiet framed surface.",
                        icon: <CreditCard />,
                        id: "two",
                        label: "Capability two",
                        points: [
                          "Panel entrance runs once on activation",
                          "Reduced-motion visitors get an instant swap",
                        ],
                        title: "Second panel, same structure",
                      },
                      {
                        description: "Keep labels short; the panel carries the detail.",
                        icon: <Sparkles />,
                        id: "three",
                        label: "Capability three",
                        points: ["Token-only styling follows every pack and preset"],
                        title: "A third story to tell",
                      },
                    ]}
                    sub="An interactive feature tour — tabs on the left, the story on the right."
                  />
                ) : null}
                {block.id === "scroll-reveal" ? (
                  <div className={styles.blockPad}>
                    <ScrollReveal>
                      <div
                        style={{
                          background: "var(--raised)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-card, 16px)",
                          padding: "1.5rem",
                        }}
                      >
                        Wrap below-fold content in <code>ScrollReveal</code> — it rises and fades in
                        once on entry, then stays. No-JS and reduced-motion visitors always see the
                        content.
                      </div>
                    </ScrollReveal>
                  </div>
                ) : null}
                {block.id === "logo-strip" ? (
                  <LogoStrip label="Trusted by teams at">
                    {["Northwind", "Acme", "Globex", "Initech", "Umbrella"].map((name) => (
                      <span key={name} style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                        {name}
                      </span>
                    ))}
                  </LogoStrip>
                ) : null}
                {block.id === "testimonial-grid" ? (
                  <TestimonialGrid
                    id="testimonial-block-preview"
                    eyebrow="Customer stories"
                    heading="What your customers say."
                    intro="Example content. Replace every quote, name, avatar, and rating with feedback you have permission to publish."
                    items={[
                      {
                        avatar: <UserRound aria-hidden="true" size={20} />,
                        name: "Example customer 1",
                        quote:
                          "A customer quote can explain which part of your product helped them and what they built with it.",
                        rating: 5,
                      },
                      {
                        avatar: <UserRound aria-hidden="true" size={20} />,
                        name: "Example customer 2",
                        quote: "Short feedback fits here too.",
                        rating: 4,
                      },
                      {
                        avatar: <UserRound aria-hidden="true" size={20} />,
                        name: "Example customer 3",
                        quote:
                          "A mixed review can stay honest: show the score the person actually submitted.",
                        rating: 2,
                      },
                      {
                        avatar: <UserRound aria-hidden="true" size={20} />,
                        name: "Example customer 4",
                        quote:
                          "Use a longer note when someone explains how they used the product, where it helped, and where it did not fit. The layout gives that detail room to breathe.",
                        rating: 5,
                      },
                    ]}
                  />
                ) : null}
                {block.id === "faq-accordion" ? (
                  <FaqAccordion
                    items={[
                      {
                        answer:
                          "Yes — every block reads theme tokens, so packs restyle it for free.",
                        question: "Does this work with every theme?",
                      },
                      {
                        answer:
                          "Copy the .tsx and .module.css into your product and rewrite the copy.",
                        question: "How do I use it in my product?",
                      },
                      {
                        answer: "Native details/summary keeps it accessible without JavaScript.",
                        question: "What about no-JS visitors?",
                      },
                    ]}
                  />
                ) : null}
                {block.id === "newsletter-band" ? (
                  <NewsletterBand
                    description="One honest line about what subscribers get and how often."
                    title="Get product updates"
                  >
                    <form action="#">
                      <input aria-label="Email" placeholder="you@example.com" type="email" />
                      <button type="submit">Subscribe</button>
                    </form>
                  </NewsletterBand>
                ) : null}
                {block.id === "waitlist-band" ? (
                  <WaitlistBand
                    description="Reserve a spot and share your invite link to climb the queue."
                    kicker="Early access"
                    shareUrl="https://app.example.test/?ref=share42"
                    status="You are #12 on the waitlist."
                    title="Join the waitlist"
                  >
                    <form action="#">
                      <input aria-label="Email" placeholder="you@example.com" type="email" />
                      <button type="submit">Join waitlist</button>
                    </form>
                  </WaitlistBand>
                ) : null}
                {block.id === "ambient-background" ? (
                  <div className={styles.ambientGrid}>
                    {(["globe", "rails", "grid", "constellation", "matrix"] as const).map(
                      (kind) => (
                        <figure className={styles.ambientCell} key={kind}>
                          <AmbientBackground kind={kind} />
                          <figcaption>{kind}</figcaption>
                        </figure>
                      ),
                    )}
                  </div>
                ) : null}
                {block.id === "cta-band" ? (
                  <CtaBand
                    cta={{ href: "#", label: "Join the waitlist" }}
                    text="One clear next step at the end of the page."
                    title="Ready when you are"
                  />
                ) : null}
                {block.id === "scroll-end-cta" ? (
                  <div className={styles.blockPad}>
                    <ScrollEndCta
                      body="This dialog shows once per session when a visitor reaches the end of the page — or after a short dwell. Replace it with your own follow-up."
                      preview
                      primary={{
                        href: "/contact",
                        hint: "Questions about the product or this demo",
                        label: "Get in touch",
                      }}
                      secondary={{
                        href: "/docs",
                        hint: "Setup, theming, and deployment",
                        label: "Read the docs",
                      }}
                      title="Still exploring?"
                    />
                  </div>
                ) : null}
                {block.id === "chart-line" ? (
                  <div className={styles.blockPad}>
                    <div
                      style={{
                        display: "grid",
                        gap: 24,
                        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                      }}
                    >
                      <ChartLine
                        label="Weekly signups"
                        points={[
                          { label: "Mon", value: 12 },
                          { label: "Tue", value: 18 },
                          { label: "Wed", value: 15 },
                          { label: "Thu", value: 26 },
                          { label: "Fri", value: 31 },
                          { label: "Sat", value: 24 },
                          { label: "Sun", value: 38 },
                        ]}
                      />
                      <ChartLine
                        label="Returning visitors"
                        points={[
                          { label: "Mon", value: 42 },
                          { label: "Tue", value: 39 },
                          { label: "Wed", value: 44 },
                          { label: "Thu", value: 41 },
                          { label: "Fri", value: 47 },
                          { label: "Sat", value: 45 },
                          { label: "Sun", value: 50 },
                        ]}
                        tone="muted"
                      />
                    </div>
                  </div>
                ) : null}
                {MINIMAL_DEMOS[block.id] ?? null}
                {block.id === "product-grid" ? (
                  <ProductGrid
                    heading="The catalog"
                    products={[
                      {
                        badge: "New",
                        description: "The hero product — one honest line of what it does.",
                        href: "#",
                        name: "Desk Mat",
                        price: "$39",
                      },
                      {
                        description: "Media tile falls back to a token-tinted monogram.",
                        href: "#",
                        name: "Notebook",
                        price: "$12",
                      },
                      {
                        description: "Third card rounds out the row.",
                        name: "Pen",
                        price: "$8",
                      },
                    ]}
                    sub="Cards for a storefront or catalog landing — images optional."
                  />
                ) : null}
                {block.id === "changelog-timeline" ? (
                  <ChangelogTimeline
                    entries={[
                      {
                        items: [
                          {
                            body: "End-to-end building blocks for chat, agents, and structured generation.",
                            title: "AI workflows",
                          },
                          {
                            body: "A native companion starter that plugs into the existing API.",
                            title: "Mobile app",
                          },
                        ],
                        meta: "Coming soon",
                        more: "… and smaller improvements, fixes, and dependency updates.",
                        summary:
                          "Features and improvements actively being built — this list may evolve with user needs and community input.",
                        tags: ["Roadmap"],
                        title: "Work in progress",
                        upcoming: true,
                      },
                      {
                        badge: "Latest",
                        kind: "Improved",
                        meta: "Sep 18, 2026",
                        points: [
                          "Local Docker storage now uses SeaweedFS instead of MinIO.",
                          "S3 credentials and the admin UI are documented in the deploy guide.",
                        ],
                        tags: ["web", "desktop"],
                        title: "Local S3 storage",
                      },
                      {
                        kind: "Fixed",
                        meta: "Sep 8, 2026",
                        points: [
                          "The account issuer column and unique index match the 1.7.2 contract.",
                        ],
                        tags: ["web"],
                        title: "Better Auth 1.7.3 account schema",
                      },
                    ]}
                  />
                ) : null}
                {block.id === "stat-grid" ? (
                  <div className={styles.blockPad}>
                    <StatGrid
                      items={[
                        {
                          delta: { change: 0.12, goodWhen: "up" },
                          label: "Active users",
                          value: "1,248",
                        },
                        {
                          delta: { change: -0.04, goodWhen: "down" },
                          label: "Bounce rate",
                          value: "38%",
                        },
                        {
                          delta: { change: null, goodWhen: "up" },
                          hint: "Last 30 days",
                          label: "Revenue",
                          value: "$4.2k",
                        },
                        { hint: "p95 across regions", label: "Latency", value: "84ms" },
                      ]}
                    />
                  </div>
                ) : null}
                {block.id === "choice-pills" ? (
                  <div className={styles.blockPad}>
                    <ChoicePills
                      defaultValue="month"
                      legend="Billing period"
                      name="kit-demo-interval"
                      options={[
                        { label: "Monthly", value: "month" },
                        { label: "Yearly", value: "year" },
                        { label: "Lifetime", value: "lifetime" },
                      ]}
                    />
                  </div>
                ) : null}
                {block.id === "data-table" ? (
                  <div className={styles.blockPad}>
                    <DataTable
                      caption="Recent orders"
                      columns={[
                        { key: "order", label: "Order" },
                        { key: "customer", label: "Customer" },
                        { key: "status", label: "Status" },
                        { align: "end", key: "total", label: "Total" },
                      ]}
                      rows={[
                        {
                          cells: {
                            customer: "maya@example.com",
                            order: "ord_0182",
                            status: "paid",
                            total: "$49.00",
                          },
                          key: "ord_0182",
                        },
                        {
                          cells: {
                            customer: "jon@example.com",
                            order: "ord_0181",
                            status: "pending",
                            total: "$12.00",
                          },
                          key: "ord_0181",
                        },
                      ]}
                    />
                  </div>
                ) : null}
                {block.id === "empty-state" ? (
                  <div className={styles.blockPad}>
                    <EmptyState
                      action={{ href: "#", label: "Create your first project" }}
                      icon={<Inbox />}
                      text="When you add something, it shows up here with status and activity."
                      title="Nothing here yet"
                    />
                  </div>
                ) : null}
                {block.id === "tooltip" ? (
                  <div className={styles.blockPad} style={{ paddingBlock: "3rem" }}>
                    <Tooltip content="Short helper copy — never the only way to reach it.">
                      <a href="#">Hover or tab here</a>
                    </Tooltip>
                  </div>
                ) : null}
                {block.id === "otp-input" ? (
                  <div className={styles.blockPad}>
                    <OtpInput label="One-time code" />
                  </div>
                ) : null}
                {block.id === "paywall-gate" ? (
                  <div className={styles.blockPad}>
                    <PaywallGate
                      cta={{ href: "#", label: "Upgrade to Pro" }}
                      excerpt="Pro subscribers read the full report — cohort retention, channel mix, and the margin bridge."
                      requiredTier="Pro"
                      title="Q3 teardown: where the growth came from"
                      preview={
                        <p>
                          Net revenue retention held at 118% while gross margin expanded 4pts — the
                          mix shift toward annual plans did most of the work…
                        </p>
                      }
                    />
                  </div>
                ) : null}
                {block.id === "data-viz-bars" ? (
                  <div className={styles.blockPad}>
                    <DataVizBars
                      bars={[
                        { label: "Mon", value: 12 },
                        { label: "Tue", value: 18 },
                        { label: "Wed", value: 9 },
                        { label: "Thu", value: 26 },
                        { label: "Fri", value: 31 },
                        { label: "Sat", value: 22 },
                        { label: "Sun", value: 38 },
                      ]}
                      label="Signups per day"
                    />
                  </div>
                ) : null}
                {block.id === "data-viz-donut" ? (
                  <div className={styles.blockPad}>
                    <DataVizDonut
                      label="Traffic by channel"
                      slices={[
                        { label: "Organic", value: 46 },
                        { label: "Referral", value: 27 },
                        { label: "Social", value: 19 },
                        { label: "Direct", value: 8 },
                      ]}
                    />
                  </div>
                ) : null}
                {block.id === "metric-trend" ? (
                  <div className={styles.blockPad}>
                    <div
                      style={{
                        display: "grid",
                        gap: 16,
                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      }}
                    >
                      <MetricTrend
                        delta={{ direction: "up", text: "+12%" }}
                        label="Active users"
                        points={[4, 6, 5, 8, 7, 11, 12]}
                        value="1,248"
                      />
                      <MetricTrend
                        delta={{ direction: "up", text: "+8%" }}
                        label="Revenue"
                        points={[3, 4, 4, 6, 5, 8, 9]}
                        value="$4.2k"
                      />
                      <MetricTrend
                        delta={{ direction: "down", text: "-6ms", tone: "positive" }}
                        label="Latency"
                        points={[14, 12, 13, 10, 11, 9, 8]}
                        value="84ms"
                      />
                      <MetricTrend
                        delta={{ direction: "flat", text: "0.0%" }}
                        label="Churn rate"
                        points={[2, 2, 2, 2, 2, 2, 2]}
                        value="1.9%"
                      />
                    </div>
                  </div>
                ) : null}
                {block.id === "site-header" ? (
                  <SiteHeader
                    brand={
                      <a href="#">
                        <Sparkles size={20} />
                        <span>Product</span>
                      </a>
                    }
                    cta={{ href: "#", label: "Get started" }}
                    links={[
                      { href: "#", label: "Features" },
                      { href: "#", label: "Pricing" },
                      { href: "#", label: "FAQ", active: true },
                      { href: "#", label: "Blog" },
                    ]}
                  />
                ) : null}
                {block.id === "site-footer" ? (
                  <SiteFooter
                    controls={
                      <>
                        <ThemeMenu side="top" align="start" />
                        <LanguageSwitcher side="top" align="start" />
                      </>
                    }
                    brand={
                      <a href="#" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <Sparkles size={20} />
                        <span>Product</span>
                      </a>
                    }
                    groups={[
                      {
                        links: [
                          { href: "/pricing", label: "Pricing" },
                          { href: "/faq", label: "FAQ" },
                          { href: "/blog", label: "Blog" },
                          { href: "/docs", label: "Docs" },
                        ],
                        title: "Product",
                      },
                      {
                        links: [
                          { href: "/contact", label: "Contact" },
                          { href: "/status", label: "Status" },
                        ],
                        title: "Company",
                      },
                      {
                        links: [
                          { href: "/privacy", label: "Privacy" },
                          { href: "/terms", label: "Terms" },
                        ],
                        title: "Legal",
                      },
                    ]}
                    legal="© 2026 Product. All rights reserved."
                    tagline="One honest sentence about what the product does."
                  />
                ) : null}
                {block.id === "prose-page" ? (
                  <ProsePage title="Privacy Policy" updated="Last updated March 2026">
                    <h2>What we collect</h2>
                    <p>
                      Write plain-language sections here. The block styles h2, h3, p, lists, and
                      links so legal copy stays readable without extra work.
                    </p>
                    <h2>How we use it</h2>
                    <ul>
                      <li>Keep sections short and specific.</li>
                      <li>Link to contact for questions.</li>
                    </ul>
                    <p>
                      See <a href="/contact">contact</a> for requests.
                    </p>
                  </ProsePage>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
