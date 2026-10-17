import type { CSSProperties, ReactNode } from "react";
import {
  Ban,
  Calendar,
  Check,
  Clock,
  Handshake,
  Link2,
  Mail,
  PenLine,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Zap,
} from "lucide-react";

import { ComparisonRuled } from "../../src/kit/blocks/marketing/comparison-ruled";
import { CtaForm } from "../../src/kit/blocks/marketing/cta-form";
import { FaqSplit } from "../../src/kit/blocks/marketing/faq-split";
import { FeatureStory } from "../../src/kit/blocks/marketing/feature-story";
import { HeroProduct } from "../../src/kit/blocks/marketing/hero-product";
import { PricingPanel } from "../../src/kit/blocks/marketing/pricing-panel";
import { ProductFrame } from "../../src/kit/blocks/marketing/product-frame";
import { StepsRuled } from "../../src/kit/blocks/marketing/steps-ruled";
import demoStyles from "./minimal-showcase.module.css";

/**
 * Composed demo for the minimal marketing set — a full generic landing for
 * a fictional scheduling product ("Acme"), rendered on the `minimal` pack.
 * Also exports per-block demo nodes for the block-by-block listing.
 */

const row: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "13px 18px",
  borderBottom: "1px solid var(--border)",
  fontSize: "0.85rem",
};

const avatar: CSSProperties = {
  width: 30,
  height: 30,
  flexShrink: 0,
  borderRadius: 999,
  background: "var(--border)",
};

const ghost: CSSProperties = {
  padding: "5px 11px",
  border: "1px solid var(--border-strong)",
  borderRadius: 999,
  fontSize: "0.72rem",
  fontWeight: 600,
  color: "var(--muted)",
};

function ListRow({ name, snippet, chip }: { name: string; snippet: string; chip?: string }) {
  return (
    <div style={row}>
      <span style={avatar} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{name}</div>
        <div
          style={{
            overflow: "hidden",
            color: "var(--muted)",
            fontSize: "0.78rem",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {snippet}
        </div>
      </div>
      {chip ? (
        <span style={{ ...ghost, borderColor: "var(--accent)", color: "var(--accent)" }}>
          {chip}
        </span>
      ) : null}
      <span style={ghost}>Edit</span>
      <span style={{ ...ghost, borderColor: "var(--accent)", color: "var(--accent)" }}>
        Approve
      </span>
    </div>
  );
}

function SettingRow({ label, hint, value }: { label: string; hint: string; value?: string }) {
  return (
    <div style={row}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{label}</div>
        <div style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{hint}</div>
      </div>
      {value ? (
        <span style={{ color: "var(--content-text)", fontSize: "0.8rem" }}>{value}</span>
      ) : (
        <span
          style={{
            position: "relative",
            width: 32,
            height: 19,
            flexShrink: 0,
            borderRadius: 999,
            background: "var(--accent)",
          }}
        >
          <i
            style={{
              position: "absolute",
              top: 2,
              left: 15,
              width: 15,
              height: 15,
              borderRadius: 999,
              background: "var(--accent-ink)",
            }}
          />
        </span>
      )}
    </div>
  );
}

function InboxVignette() {
  return (
    <div>
      <ListRow chip="Call" name="Maya Chen" snippet="Intro call — Thursday 14:00 works for me…" />
      <ListRow name="Jon Reyes" snippet="Can we move the demo to next week?" />
      <ListRow chip="Call" name="Sara Lindt" snippet="Confirmed — sending the agenda over now." />
    </div>
  );
}

function SettingsVignette() {
  return (
    <div>
      <SettingRow hint="Between meetings" label="Buffer" value="10 min" />
      <SettingRow hint="Invitee local time" label="Working hours" value="09:00–17:00" />
      <SettingRow hint="Per day" label="Meeting limit" value="6" />
      <SettingRow hint="Email + calendar" label="Reminders" />
      <SettingRow hint="On conflicts" label="Auto-decline" />
    </div>
  );
}

function HeroProductUi() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "34% 1fr", minHeight: 300 }}>
      <div style={{ borderRight: "1px solid var(--border)", padding: 22 }}>
        {["Event name", "Duration"].map((label) => (
          <label
            key={label}
            style={{
              display: "block",
              marginBottom: 14,
              color: "var(--muted)",
              fontSize: "0.78rem",
              fontWeight: 600,
            }}
          >
            {label}
            <span
              style={{
                display: "block",
                marginTop: 7,
                padding: "10px 13px",
                border: "1px solid var(--border-strong)",
                borderRadius: 8,
                background: "var(--raised)",
                color: "var(--text)",
                fontSize: "0.88rem",
                fontWeight: 400,
              }}
            >
              {label === "Event name" ? "Intro call" : "30 min"}
            </span>
          </label>
        ))}
        <span
          style={{
            display: "block",
            padding: "12px 0",
            borderRadius: 999,
            background: "var(--btn)",
            color: "var(--btn-text)",
            fontSize: "0.88rem",
            fontWeight: 550,
            textAlign: "center",
          }}
        >
          Create link
        </span>
      </div>
      <div style={{ background: "var(--section)", padding: "8px 0" }}>
        <div
          style={{
            padding: "8px 18px",
            color: "var(--muted)",
            fontSize: "0.76rem",
            fontWeight: 600,
          }}
        >
          This week
        </div>
        {[
          ["Maya Chen", "Intro call · Thu 14:00"],
          ["Jon Reyes", "Demo · Fri 10:30"],
          ["Sara Lindt", "Catch-up · Fri 16:00"],
        ].map(([name, line]) => (
          <div key={name} style={{ ...row, borderBottom: "1px solid var(--border)" }}>
            <span style={avatar} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{name}</div>
              <div style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{line}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The full composed landing — wrap it in `.marketing-theme` + data-theme="minimal". */
export function MinimalShowcase() {
  return (
    <>
      <HeroProduct
        eyebrow="Scheduling for small teams"
        titleId="minimal-showcase-hero"
        lede="Acme reads your calendar and handles the back-and-forth, so a booking link is the only thing you ever send."
        primary={{ href: "#", label: "Get started" }}
        product={<HeroProductUi />}
        productUrl="app.acme.dev/inbox"
        secondary={{ href: "#", label: "See how it works" }}
        title="Bookings that"
        titleBreak="run themselves."
      />
      <StepsRuled
        eyebrow="How it works"
        steps={[
          {
            icon: <Calendar />,
            text: "Acme reads your availability — nothing else.",
            title: "Connect your calendar",
          },
          {
            icon: <SlidersHorizontal />,
            text: "Buffers, working hours, and daily limits in one place.",
            title: "Set the rules",
          },
          {
            icon: <Link2 />,
            text: "Invitees pick a time; Acme writes the event and the emails.",
            title: "Share one link",
          },
          {
            icon: <Handshake />,
            text: "Reminders, reschedule links, and no-shows are handled.",
            title: "Show up",
          },
        ]}
        sub="Four steps, then the calendar runs itself."
        title="From first visit to booked call."
      />
      <FeatureStory
        rows={[
          {
            media: <InboxVignette />,
            mediaLabel: "To approve",
            mediaMeta: "3 pending",
            points: [
              { icon: <Check />, text: "Nothing books without you.", title: "Review mode" },
              { icon: <Mail />, text: "Confirmations send themselves.", title: "Auto-confirm" },
              { icon: <Zap />, text: "Reschedules handled too.", title: "Autonomous" },
            ],
            text: "Every booking can wait in a review queue — glance, edit, or confirm. When you trust the rules, loosen the mode and Acme works inside your limits.",
            title: "Approve every booking, or none.",
          },
          {
            media: <SettingsVignette />,
            mediaLabel: "Preferences",
            points: [
              { icon: <Clock />, text: "Breathing room between calls.", title: "Buffers" },
              { icon: <Ban />, text: "Hard caps per day.", title: "Limits" },
              {
                icon: <ShieldCheck />,
                text: "Nudges before every meeting.",
                title: "Reminders",
              },
            ],
            text: "Buffers, working hours, and meeting caps are enforced before anything is written to your calendar — not suggested to a helper that might forget.",
            title: "Rules that hold up under load.",
          },
        ]}
      />
      <ComparisonRuled
        columns={["", "Typical schedulers", "Acme"]}
        eyebrow="Why not another tool"
        rows={[
          { label: "Setup", them: "Forms and embeds", us: "One link per person" },
          { label: "Back-and-forth", them: "Still on you", us: "Handled end to end" },
          { label: "Rules", them: "Suggested", us: "Enforced before booking" },
          { label: "Data", them: "Reads every event", us: "Availability only" },
        ]}
        sub="Same job description, different tool."
        title="Schedulers automate the link. Acme automates the day."
      />
      <PricingPanel
        eyebrow="Pricing"
        sub="Plans open with early access."
        tiers={[
          {
            cta: { href: "#", label: "Start free" },
            description: "One link, one calendar.",
            features: ["1 booking page", "50 bookings a month", "Email reminders"],
            name: "Free",
            price: "$0",
          },
          {
            cta: { href: "#", label: "Start free" },
            description: "For people who live on calls.",
            features: ["Unlimited booking pages", "Approval queue", "Buffers and limits"],
            name: "Starter",
            price: "$8",
            recommended: true,
            recommendedLabel: "Recommended",
          },
          {
            cta: { href: "#", label: "Talk to us" },
            description: "For the whole team.",
            features: ["Round-robin links", "Shared calendars", "Priority support"],
            name: "Team",
            price: "$18",
          },
        ]}
        title="Pricing"
      />
      <FaqSplit
        defaultOpen={0}
        items={[
          {
            a: "No — it reads availability only. Event contents stay private and never feed suggestions.",
            q: "Does Acme read my whole calendar?",
          },
          {
            a: "Invitees get a reschedule link; Acme moves the event inside your rules and emails both sides.",
            q: "What happens when someone reschedules?",
          },
          {
            a: "Yes — review mode keeps every booking pending until you approve it.",
            q: "Can I approve bookings manually?",
          },
          {
            a: "The free tier is free while in early access. Paid tiers unlock approval queues and team links.",
            q: "Is the free tier really free?",
          },
        ]}
        sub="Everything about what Acme reads, writes, and safeguards."
        title="Questions, answered."
      />
      <CtaForm
        note="We invite new accounts in weekly waves — first come, first served."
        sub="Reserve a link and we'll open your account in the next wave."
        title="Put scheduling on autopilot."
      >
        <form>
          <CtaForm.Input aria-label="Email" placeholder="you@example.com" type="email" />
          <CtaForm.Button>Join the waitlist</CtaForm.Button>
        </form>
      </CtaForm>
    </>
  );
}

/**
 * Quiet "live" status line for a frame's `status` slot — an accent dot, a
 * mono label and three states that crossfade on an 8s CSS loop. Fails open:
 * only the first state paints under reduced motion, no-JS, or browsers
 * without the `scripting` media feature, and screen readers get a single
 * sr-only summary instead of the cycling copies.
 */
function StatusTicker({ label, states }: Readonly<{ label: string; states: readonly string[] }>) {
  return (
    <span className={demoStyles.ticker}>
      <span aria-hidden="true" className={demoStyles.tickerDot} />
      <span className={demoStyles.tickerLabel}>{label}</span>
      <span className={demoStyles.tickerViewport}>
        <span className={demoStyles.srOnly}>{states.join(" → ")}</span>
        {states.map((state, index) => (
          <span
            aria-hidden="true"
            className={demoStyles.tickerItem}
            key={state}
            style={{ "--tick-i": index } as CSSProperties}
          >
            {state}
          </span>
        ))}
      </span>
    </span>
  );
}

/** Per-block demo nodes for the block-by-block listing (block.id → demo). */
export const MINIMAL_DEMOS: Record<string, ReactNode> = {
  "product-frame": (
    <div style={{ display: "grid", gap: 28 }}>
      <ProductFrame url="app.acme.dev/settings">
        <SettingsVignette />
      </ProductFrame>
      <ProductFrame
        brand={
          <>
            <Calendar size={16} />
            <span>Acme</span>
          </>
        }
        chrome="app"
        status={
          <StatusTicker
            label="Queue"
            states={[
              "3 bookings pending approval",
              "Reminder sent to Maya Chen",
              "Calendar synced 1m ago",
            ]}
          />
        }
        tabs={[{ label: "Links" }, { label: "Bookings" }, { label: "Settings", active: true }]}
      >
        <SettingsVignette />
      </ProductFrame>
    </div>
  ),
  "hero-product": (
    <HeroProduct
      eyebrow="Scheduling for small teams"
      lede="One line that says what the product does — the product window below does the convincing."
      primary={{ href: "#", label: "Get started" }}
      product={<SettingsVignette />}
      productUrl="app.acme.dev/settings"
      secondary={{ href: "#", label: "See it live" }}
      title="Bookings that"
      titleBreak="run themselves."
    />
  ),
  "steps-ruled": (
    <StepsRuled
      eyebrow="How it works"
      steps={[
        {
          icon: <Search />,
          text: "Connect and Acme reads availability only.",
          title: "Connect",
        },
        { icon: <PenLine />, text: "Buffers and limits in one place.", title: "Set rules" },
        { icon: <Link2 />, text: "One link does all the work.", title: "Share" },
      ]}
      sub="Three steps, then it runs itself."
      title="From setup to hands-off."
    />
  ),
  "feature-story": (
    <FeatureStory
      rows={[
        {
          media: <InboxVignette />,
          mediaLabel: "To approve",
          mediaMeta: "3 pending",
          points: [
            { icon: <Check />, text: "Nothing books without you.", title: "Review mode" },
            { icon: <Mail />, text: "Confirmations send themselves.", title: "Auto-confirm" },
          ],
          text: "Every booking can wait in a review queue — glance, edit, or confirm before it lands.",
          title: "Approve every booking, or none.",
        },
      ]}
    />
  ),
  "comparison-ruled": (
    <ComparisonRuled
      columns={["", "Typical schedulers", "Acme"]}
      eyebrow="Why us"
      rows={[
        { label: "Setup", them: "Forms and embeds", us: "One link per person" },
        { label: "Back-and-forth", them: "Still on you", us: "Handled end to end" },
      ]}
      sub="Same job, different tool."
      title="Schedulers automate the link."
    />
  ),
  "pricing-panel": (
    <PricingPanel
      eyebrow="Pricing"
      sub="Honest limits, one recommendation."
      tiers={[
        {
          cta: { href: "#", label: "Start free" },
          description: "One link, one calendar.",
          features: ["1 booking page", "Email reminders"],
          name: "Free",
          price: "$0",
        },
        {
          cta: { href: "#", label: "Start free" },
          description: "For people who live on calls.",
          features: ["Unlimited pages", "Approval queue", "Buffers and limits"],
          name: "Starter",
          price: "$8",
          recommended: true,
          recommendedLabel: "Recommended",
        },
      ]}
      title="Pricing"
    />
  ),
  "faq-split": (
    <FaqSplit
      defaultOpen={0}
      items={[
        {
          a: "Availability only — event contents are never read.",
          q: "Does Acme read my whole calendar?",
        },
        { a: "Reschedule links move events inside your rules.", q: "What about reschedules?" },
        { a: "Yes — review mode keeps every booking pending.", q: "Can I approve manually?" },
      ]}
      sub="The short version, honestly answered."
      title="Questions, answered."
    />
  ),
  "cta-form": (
    <CtaForm
      note="We invite new accounts in weekly waves."
      sub="Reserve a link and we'll open your account in the next wave."
      title="Put scheduling on autopilot."
    >
      <form>
        <CtaForm.Input aria-label="Email" placeholder="you@example.com" type="email" />
        <CtaForm.Button>Join the waitlist</CtaForm.Button>
      </form>
    </CtaForm>
  ),
};
