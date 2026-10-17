import { getDictionary, type AppLocale } from "@supastack/i18n";
import { parsePublicConfig, parseServerConfig } from "@supastack/config";
import {
  Activity,
  ArrowDownWideNarrow,
  Bell,
  Code2,
  CreditCard,
  MousePointerClick,
  Radar,
  Route,
} from "lucide-react";
import type { ReactNode } from "react";

import { CaptchaWidget } from "./captcha-widget";
import { joinWaitlistAction } from "./growth/waitlist-actions";
import {
  buildWaitlistShareUrl,
  sanitizeGrowthParam,
  waitlistStatusMessage,
} from "./growth/waitlist";
import { StatGrid } from "./kit/blocks/app/stat-grid";
import { CtaBand } from "./kit/blocks/marketing/cta-band";
import { FaqSplit } from "./kit/blocks/marketing/faq-split";
import { FeatureStory } from "./kit/blocks/marketing/feature-story";
import { HeroProduct } from "./kit/blocks/marketing/hero-product";
import { PricingPanel } from "./kit/blocks/marketing/pricing-panel";
import { ScrollEndCta } from "./kit/blocks/marketing/scroll-end-cta";
import { ScrollReveal } from "./kit/blocks/marketing/scroll-reveal";
import { StepsRuled } from "./kit/blocks/marketing/steps-ruled";
import { WaitlistBand } from "./kit/blocks/marketing/waitlist-band";
import { marketingFontClassName } from "./marketing/fonts";
import { HomeShell } from "./marketing/home-shell";
import { LocaleHtmlLang } from "./marketing/locale-html-lang";
import { faqPageJsonLd, JsonLd } from "./marketing/seo";
import { SiteFooter } from "./marketing/site-footer";
import { SiteHeader } from "./marketing/site-header";
import type { LandingPreview } from "./landing-preview";
import { fmtMoney, fmtNum, fmtPct } from "./supadata/format";
import { TrendChart } from "./supadata/web/trend-chart";
import marketing from "./marketing/marketing.module.css";
import styles from "./landing-page.module.css";

const TIERS = [
  {
    name: "Basic",
    price: "$0",
    description: "An example entry plan for an individual workspace.",
    features: ["1 site", "Core analytics", "30-day retention"],
    cta: { href: "/auth", label: "Try the demo" },
  },
  {
    name: "Team",
    price: "$19",
    period: "month",
    description: "An example plan for a workspace with several members.",
    features: ["10 sites", "Revenue attribution", "Goals and funnels"],
    cta: { href: "/auth", label: "Try the demo" },
    recommended: true,
  },
  {
    name: "Business",
    price: "$49",
    period: "month",
    description: "An example plan for additional workspace controls.",
    features: ["Unlimited sites", "Alerts and integrations", "API access"],
    cta: { href: "/auth", label: "Try the demo" },
  },
] as const;

const FAQ = [
  {
    question: "What does the tracking script collect?",
    answer:
      "Pageviews, sessions, referrers, UTM parameters, ad click IDs, coarse geography, device, browser, and OS — plus any custom events, goals, and outbound-link clicks you mark. A first-party visitor identifier stays on your domain; nothing is shared across sites.",
  },
  {
    question: "How does revenue attribution work?",
    answer:
      "Send payments through the API or connect a billing webhook. Each payment is joined to the visitor by email, user id, or visitor id, then attributed to the channel, source, and campaign that brought them in.",
  },
  {
    question: "Which billing providers can I connect?",
    answer:
      "The webhook adapters normalize events from providers such as Stripe, Lemon Squeezy, Polar, Paddle, Shopify, WooCommerce, and Dodo. Subscription revenue feeds MRR and lifetime-value reporting automatically.",
  },
  {
    question: "Can I share a dashboard publicly?",
    answer:
      "Every site gets an optional share link that renders a read-only dashboard — visitors, sources, revenue — without exposing workspace access. This landing's live demo is one of those links.",
  },
  {
    question: "Is there an API?",
    answer:
      "Sites, analytics, visitors, payments, goals, funnels, alerts, and integrations are all available over a versioned REST API with key-based authentication.",
  },
] as const;

/** Hairline bar list used inside story vignettes — real data, flat presentation. */
function VignetteRows({
  rows,
  format,
}: {
  rows: readonly { label: string; value: number; share: number }[];
  format: (n: number) => string;
}) {
  return (
    <ul className={styles.vigRows}>
      {rows.map((r) => (
        <li className={styles.vigRow} key={r.label}>
          <span className={styles.vigLabel}>{r.label}</span>
          <span className={styles.vigTrack}>
            <span className={styles.vigFill} style={{ width: `${Math.max(2, r.share * 100)}%` }} />
          </span>
          <span className={styles.vigValue}>{format(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

function heroProduct(preview: LandingPreview): ReactNode {
  const ov = preview.overview;
  const maxVisitors = Math.max(...preview.topPages.map((p) => p.visitors), 1);
  return (
    <div className={styles.preview}>
      <StatGrid
        items={[
          { label: "Visitors", value: fmtNum(ov.visitors) },
          { label: "Pageviews", value: fmtNum(ov.pageviews) },
          { label: "Bounce rate", value: fmtPct(ov.bounceRate) },
          { label: "Revenue", value: fmtMoney(ov.revenueCents) },
        ]}
      />
      <TrendChart points={preview.trend} />
      <div className={styles.previewFoot}>
        <VignetteRows
          format={fmtNum}
          rows={preview.topPages.map((p) => ({
            label: p.value,
            value: p.visitors,
            share: p.visitors / maxVisitors,
          }))}
        />
      </div>
    </div>
  );
}

export type LandingWaitlistQuery = Readonly<{
  status?: string | undefined;
  position?: string | undefined;
  code?: string | undefined;
}>;

/**
 * Template landing page — composed entirely from kit blocks so it restyles
 * with every theme pack and preset. Replace this copy with your product's.
 * The waitlist band is wired to `joinWaitlistAction`; proxy.ts feeds it
 * `?ref=` attribution and it redirects back with `?waitlist=…` status params.
 * `preview` carries real demo-site analytics for the product vignettes.
 */
export function LandingPage({
  locale = "en",
  waitlist,
  preview,
}: Readonly<{
  locale?: AppLocale;
  waitlist?: LandingWaitlistQuery;
  preview?: LandingPreview | null;
}> = {}) {
  const copy = getDictionary(locale).marketingLanding;
  const publicConfig = parsePublicConfig(parseServerConfig());
  const turnstileSiteKey =
    publicConfig.captcha.provider === "turnstile"
      ? publicConfig.captcha.turnstileSiteKey
      : undefined;

  const position = Number(waitlist?.position);
  const referralCode = sanitizeGrowthParam(waitlist?.code);
  const waitlistStatus = waitlistStatusMessage(waitlist?.status, {
    position: Number.isFinite(position) && position > 0 ? position : undefined,
    referralCode: referralCode ?? undefined,
  });
  const shareUrl = referralCode
    ? buildWaitlistShareUrl(publicConfig.app.webUrl, referralCode)
    : undefined;

  const maxChannel = preview ? Math.max(...preview.channels.map((c) => c.revenueCents), 1) : 1;
  const storyRows = preview
    ? [
        {
          title: "Attribution, not approximation",
          text: "Every payment lands with its channel, source, and campaign attached — from the visitor's first touch to the session that converted.",
          mediaLabel: "Revenue by channel",
          mediaMeta: "Last 30 days",
          media: (
            <VignetteRows
              format={fmtMoney}
              rows={preview.channels.map((c) => ({
                label: c.value,
                value: c.revenueCents,
                share: c.revenueCents / maxChannel,
              }))}
            />
          ),
          points: [
            {
              icon: <MousePointerClick size={16} />,
              title: "First + last touch",
              text: "Both acquisition views kept per visitor.",
            },
            {
              icon: <Route size={16} />,
              title: "UTM + click IDs",
              text: "gclid, fbclid, and friends parsed at ingest.",
            },
            {
              icon: <CreditCard size={16} />,
              title: "Provider webhooks",
              text: "Payments normalized into the same funnel.",
            },
          ],
        },
        {
          title: "Live, not sampled",
          text: "Realtime shows who is on the site right now — page, country, and device — while full-fidelity events keep every session's complete journey searchable later.",
          mediaLabel: "On the site now",
          mediaMeta: `${preview.live.online} online`,
          media: (
            <ul className={styles.vigLive}>
              {preview.live.visitors.map((v, i) => (
                <li className={styles.vigLiveRow} key={i}>
                  <span aria-hidden="true" className={styles.vigDot} />
                  <span className={styles.vigLabel}>{v.page ?? "/"}</span>
                  <span className={styles.vigMetaText}>
                    {[v.country, v.device].filter(Boolean).join(" · ") || "—"}
                  </span>
                </li>
              ))}
              {preview.live.visitors.length === 0 ? (
                <li className={styles.vigLiveRow}>
                  <span className={styles.vigMetaText}>
                    Quiet right now — open the demo and appear.
                  </span>
                </li>
              ) : null}
            </ul>
          ),
          points: [
            {
              icon: <Radar size={16} />,
              title: "Realtime visitors",
              text: "Five-minute window, updated live.",
            },
            {
              icon: <Activity size={16} />,
              title: "Full event history",
              text: "Every pageview and event kept per visitor.",
            },
            {
              icon: <ArrowDownWideNarrow size={16} />,
              title: "No sampling",
              text: "Raw rows power every number shown.",
            },
          ],
        },
        ...(preview.funnel
          ? [
              {
                title: "Goals, funnels, and alerts",
                text: "Mark the events that matter, watch conversion through each funnel step, and let threshold alerts flag the spikes and drops.",
                mediaLabel: preview.funnel.name,
                mediaMeta: "Conversion",
                media: (
                  <ul className={styles.vigFunnel}>
                    {preview.funnel.steps.map((s, i) => (
                      <li className={styles.vigFunnelStep} key={s.label}>
                        <span className={styles.vigStepNo}>{i + 1}</span>
                        <span className={styles.vigLabel}>{s.label}</span>
                        <span className={styles.vigValue}>
                          {fmtNum(s.visitors)} · {fmtPct(s.conversion)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ),
                points: [
                  {
                    icon: <MousePointerClick size={16} />,
                    title: "Goal tracking",
                    text: "Page rules or events become goals.",
                  },
                  {
                    icon: <ArrowDownWideNarrow size={16} />,
                    title: "Step funnels",
                    text: "Ordered conversion across any steps.",
                  },
                  {
                    icon: <Bell size={16} />,
                    title: "Threshold alerts",
                    text: "Notify on spikes, drops, and totals.",
                  },
                ],
              },
            ]
          : []),
      ]
    : [];

  return (
    <HomeShell className={`marketing-theme ${marketing.home} ${marketingFontClassName}`}>
      <LocaleHtmlLang locale={locale} />
      <JsonLd data={faqPageJsonLd([...FAQ])} />
      <a className={marketing.skip} href="#main">
        Skip to content
      </a>
      <SiteHeader locale={locale} />
      <main className={marketing.main} id="main">
        <HeroProduct
          chrome="app"
          eyebrow="Web analytics · revenue attribution"
          lede="First-party analytics that connects every visit to the payment it became — visitor journeys, funnels, goals, and live traffic in one dashboard, wired to your billing provider. This site runs on the supastack boilerplate; the numbers below are seeded sample data."
          primary={{ href: "/auth", label: copy.primaryAction }}
          product={preview ? heroProduct(preview) : undefined}
          productBrand={
            preview ? <span className={styles.frameBrand}>{preview.siteName}</span> : undefined
          }
          productStatus={
            preview ? (
              <span>
                Sample data ·{" "}
                <a className={styles.frameLink} href={preview.shareUrl}>
                  Open the full live dashboard
                </a>
              </span>
            ) : undefined
          }
          productTabs={[
            { label: "Overview", active: true },
            { label: "Live" },
            { label: "Visitors" },
            { label: "Goals" },
          ]}
          secondary={
            preview
              ? { href: preview.shareUrl, label: "View live demo" }
              : { href: "/docs", label: "Read the docs" }
          }
          title="Know where your revenue"
          titleBreak="actually comes from."
        />
        <WaitlistBand
          title="Join the sample waitlist"
          description="This form demonstrates email signup and referral links. Replace it with your product’s launch details."
          status={waitlistStatus}
          shareUrl={shareUrl}
        >
          <form action={joinWaitlistAction}>
            <input type="hidden" name="locale" value={locale} />
            <input
              aria-label="Email"
              autoComplete="email"
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />
            <button type="submit">Join waitlist</button>
            {turnstileSiteKey ? <CaptchaWidget siteKey={turnstileSiteKey} /> : null}
          </form>
        </WaitlistBand>
        <div className={styles.anchor} id="features">
          <StepsRuled
            eyebrow="Setup"
            steps={[
              {
                icon: <Code2 size={18} />,
                title: "Add the snippet",
                text: "Drop sd.js on your pages with a site key. Pageviews, referrers, UTMs, and click IDs start flowing immediately.",
              },
              {
                icon: <Radar size={18} />,
                title: "Watch traffic resolve",
                text: "Sessions, devices, and locations build themselves. Custom events and goals fill in the rest of the picture.",
              },
              {
                icon: <CreditCard size={18} />,
                title: "See what paid",
                text: "Billing webhooks tie each payment back to the channel and campaign that earned it.",
              },
            ]}
            sub="One script tag on your site, one webhook from your billing provider."
            title="Script tag to revenue in three steps"
          />
        </div>
        {storyRows.length > 0 ? (
          <ScrollReveal>
            <FeatureStory rows={storyRows} />
          </ScrollReveal>
        ) : null}
        <div className={styles.anchor} id="pricing">
          <ScrollReveal>
            <PricingPanel
              eyebrow="Pricing"
              sub="Illustrative prices for the demo. Replace these plans with your product’s billing catalog."
              tiers={TIERS}
              title="Sample pricing"
            />
          </ScrollReveal>
        </div>
        <div className={styles.anchor} id="faq">
          <ScrollReveal>
            <FaqSplit
              items={FAQ.map(({ question: q, answer: a }) => ({ q, a }))}
              sub="The mechanics behind the demo you just saw."
              title="Questions"
            />
          </ScrollReveal>
        </div>
        <ScrollReveal>
          <CtaBand
            title="Point it at your own site."
            text="Create a workspace, mint a site key, and watch your real traffic replace this sample data."
            cta={{ href: "/auth", label: copy.primaryAction }}
          />
        </ScrollReveal>
      </main>
      <SiteFooter locale={locale} />
      <ScrollEndCta
        title="Still exploring?"
        body="This dialog shows once per session when a visitor reaches the end of the page. Replace it with your own follow-up — a contact link, a signup prompt, or a booking."
        primary={{
          href: "/contact",
          label: "Get in touch",
          hint: "Questions about the product or this demo",
        }}
        secondary={{
          href: "/docs",
          label: "Read the docs",
          hint: "Setup, theming, and deployment",
        }}
      />
    </HomeShell>
  );
}
