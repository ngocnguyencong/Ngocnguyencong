import { KIT_BLOCKS } from "../kit/blocks";
import type { Guide, Section } from "./content";

const groupBySurface = {
  marketing: "Marketing blocks",
  app: "App blocks",
  chrome: "Site chrome",
} as const;
const templates = {
  usage: [
    "The snippet imports the block from `apps/web/src/kit/blocks/` using a path relative to `apps/web/app/page.tsx`; adjust the relative depth for your route.",
    "The JSX below is a source-backed example of the shipped block API. Replace its sample copy and data with your product's own content.",
  ],
  props:
    "The declarations below are copied from the component source, including any exported prop aliases and compound-component members.",
  files: "These paths are the complete source-file list registered for this block in `KIT_BLOCKS`.",
  composition: [
    "This is presentation UI. It renders caller-supplied props and does not fetch data, persist records, or enforce authorization.",
    "Keep data loading, form handling, persistence, and access checks in your product's page or server code. Render the block within the matching marketing or app theme surface.",
  ],
} as const;

type BlockReference = {
  props: string;
  usage: string;
};

const blockReferences: Readonly<Record<string, BlockReference>> = {
  "master-detail": {
    props: `import type { ReactNode } from "react";

export type MasterDetailItem = { key: string; title: string };

export type MasterDetailProps<T extends MasterDetailItem> = {
  items: readonly T[];
  selectedKey: string | null;
  onSelectionChange: (key: string | null) => void;
  renderListItem?: (item: T, selected: boolean) => ReactNode;
  renderDetail: (item: T) => ReactNode;
  listLabel: string;
  detailLabel: string;
  backLabel: string;
  empty?: ReactNode;
  loading?: boolean;
  loadingState?: ReactNode;
  error?: ReactNode;
};

export function MasterDetail<T extends MasterDetailItem>({
  items,
  selectedKey,
  onSelectionChange,
  renderListItem,
  renderDetail,
  listLabel,
  detailLabel,
  backLabel,
  empty,
  loading = false,
  loadingState,
  error,
}: MasterDetailProps<T>)`,
    usage: `"use client";
import { useState } from "react";
import { MasterDetail } from "../src/kit/blocks/app/master-detail";
export function MasterDetailUsageExample() {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const items = [{ key: "first", title: "First record" }, { key: "second", title: "Second record" }];
  return <MasterDetail items={items} selectedKey={selectedKey} onSelectionChange={setSelectedKey} renderDetail={(item) => <p>{item.title}</p>} listLabel="Records" detailLabel="Record details" backLabel="Back to records" />;
}`,
  },
  "table-toolbar": {
    props: `import type { ReactNode } from "react";

export type TableToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  searchLabel: string;
  resultCount: number;
  countLabel: (count: number) => ReactNode;
  clearFiltersLabel: string;
  onClearFilters: () => void;
  clearFiltersDisabled?: boolean;
  disabled?: boolean;
  children?: ReactNode;
};

export function TableToolbar({
  search,
  onSearchChange,
  searchLabel,
  resultCount,
  countLabel,
  clearFiltersLabel,
  onClearFilters,
  clearFiltersDisabled = false,
  disabled = false,
  children,
}: TableToolbarProps)`,
    usage: `"use client";
import { useState } from "react";
import { TableToolbar } from "../src/kit/blocks/app/table-toolbar";
export function TableToolbarUsageExample() {
  const [search, setSearch] = useState("");
  return <TableToolbar search={search} onSearchChange={setSearch} searchLabel="Search records" resultCount={2} countLabel={(count) => \`\${count} sample records\`} clearFiltersLabel="Clear filters" onClearFilters={() => setSearch("")} clearFiltersDisabled={search.length === 0} />;
}`,
  },
  pagination: {
    props: `import type { ReactNode } from "react";

export type PaginationProps = {
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  label: string;
  previousLabel: string;
  nextLabel: string;
  pageLabel: (page: number, pageCount: number) => ReactNode;
  noPagesLabel: string;
  disabled?: boolean;
};

export function Pagination({
  currentPage,
  pageCount,
  onPageChange,
  label,
  previousLabel,
  nextLabel,
  pageLabel,
  noPagesLabel,
  disabled = false,
}: PaginationProps)`,
    usage: `"use client";
import { useState } from "react";
import { Pagination } from "../src/kit/blocks/app/pagination";
export function PaginationUsageExample() {
  const [page, setPage] = useState(1);
  return <Pagination currentPage={page} pageCount={3} onPageChange={setPage} label="Record pages" previousLabel="Previous page" nextLabel="Next page" pageLabel={(current, total) => \`Page \${current} of \${total}\`} noPagesLabel="No pages" />;
}`,
  },
  "hero-centered": {
    props: `import type { ReactNode } from "react";

export type HeroAction = { href: string; label: string };

export function HeroCentered({
  kicker,
  title,
  accent,
  subtitle,
  lede,
  children,
  primary,
  secondary,
  trust,
}: {
  kicker?: string | undefined;
  /** Plain headline — pass \`accent\` for the emphasized tail. */
  title: string;
  /** Emphasized span appended to the title (renders in --accent, serif if the surface has one). */
  accent?: string | undefined;
  /** A separate second headline line. */
  subtitle?: string | undefined;
  lede?: string | undefined;
  /** Caller-owned content between the headline/copy and actions. */
  children?: ReactNode;
  primary: HeroAction;
  secondary?: HeroAction | undefined;
  trust?: { href: string; label: string; avatars: ReactNode } | undefined;
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { HeroCentered } from "../src/kit/blocks/marketing/hero-centered";
export function HeroCenteredUsageExample() {
  return (
    <HeroCentered
      accent="that converts."
      kicker="Now in early access"
      lede="One line that says what the product does and who it is for — swap in your own."
      primary={{ href: "#", label: "Get started" }}
      secondary={{ href: "#", label: "See how it works" }}
      title="A headline worth reading"
    />
  );
}`,
  },
  "feature-grid": {
    props: `import type { ReactNode } from "react";

export type FeatureItem = {
  /** Caller-supplied icon (e.g. a lucide-react glyph with aria-hidden). */
  icon: ReactNode;
  title: string;
  description: string;
};

export function FeatureGrid({
  heading,
  sub,
  items,
}: {
  heading?: string | undefined;
  sub?: string | undefined;
  items: readonly FeatureItem[];
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { FeatureGrid } from "../src/kit/blocks/marketing/feature-grid";
import { BookOpen, Sparkles, Zap } from "lucide-react";
export function FeatureGridUsageExample() {
  return (
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
          description:
            "Tokens, blocks, and styles your agent can extend safely.",
          icon: <BookOpen />,
          title: "Agent-ready",
        },
        {
          description:
            "Packs and presets restyle every block without rewrites.",
          icon: <Sparkles />,
          title: "Themeable",
        },
      ]}
      sub="Three to six short reasons your product is worth trying."
    />
  );
}`,
  },
  "pricing-cards": {
    props: `export type PricingTier = {
  name: string;
  price: string;
  period?: string | undefined;
  description: string;
  features: readonly string[];
  cta: { href: string; label: string };
  recommended?: boolean | undefined;
};

export function PricingCards({
  heading,
  sub,
  tiers,
}: {
  heading?: string | undefined;
  sub?: string | undefined;
  tiers: readonly PricingTier[];
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { PricingCards } from "../src/kit/blocks/marketing/pricing-cards";
export function PricingCardsUsageExample() {
  return (
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
  );
}`,
  },
  "hero-split": {
    props: `import type { ReactNode } from "react";

export function HeroSplit({
  kicker,
  title,
  accent,
  lede,
  primary,
  secondary,
  media,
  proof,
}: {
  kicker?: string | undefined;
  title: string;
  accent?: string | undefined;
  lede: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string } | undefined;
  media: ReactNode;
  /** Small line under the CTAs — e.g. "Free while in beta". */
  proof?: string | undefined;
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { HeroSplit } from "../src/kit/blocks/marketing/hero-split";
export function HeroSplitUsageExample() {
  return (
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
  );
}`,
  },
  "section-header": {
    props: `export function SectionHeader({
  eyebrow,
  title,
  sub,
  align = "center",
}: {
  eyebrow?: string | null | undefined;
  title: string;
  sub?: string | undefined;
  align?: "center" | "left" | undefined;
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { SectionHeader } from "../src/kit/blocks/marketing/section-header";
export function SectionHeaderUsageExample() {
  return (
    <SectionHeader
      eyebrow="Why us"
      sub="A supporting sentence that earns its place under the title."
      title="A section that needs an introduction"
    />
  );
}`,
  },
  "feature-rows": {
    props: `import type { ReactNode } from "react";

export type FeatureRow = {
  eyebrow?: string | undefined;
  title: string;
  description: string;
  /** Optional bullet points under the description. */
  bullets?: readonly { title: string; text: string }[] | undefined;
  /** Media slot (screenshot/illustration) — alternates left/right automatically. */
  media?: ReactNode | undefined;
};

export function FeatureRows({ items }: { items: readonly FeatureRow[] })`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { FeatureRows } from "../src/kit/blocks/marketing/feature-rows";
export function FeatureRowsUsageExample() {
  return (
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
            {
              title: "Media slot",
              text: "Drop real screenshots, not placeholders.",
            },
          ],
          description:
            "Bullets carry the details when a paragraph is not enough.",
          eyebrow: "Details",
          title: "Second row flips the composition",
        },
      ]}
    />
  );
}`,
  },
  "feature-spotlight": {
    props: `import type { ReactNode } from "react";

export type SpotlightMini = {
  /** Caller-supplied icon (e.g. a lucide-react glyph with aria-hidden). */
  icon?: ReactNode;
  title: string;
  body: string;
};

export function FeatureSpotlight({
  eyebrow,
  title,
  sub,
  media,
  heading,
  description,
  support,
  minis,
  ordered = false,
  reverse = false,
}: {
  eyebrow?: string | undefined;
  title: string;
  sub?: string | undefined;
  /** Media slot — a real product visual or coded mock, never a grey box. */
  media: ReactNode;
  /** Heading beside the media. */
  heading: string;
  description: string;
  /** Quieter second paragraph under the description. */
  support?: string | undefined;
  /** Container-less mini points — icon + title + one line each. */
  minis: readonly SpotlightMini[];
  /** Set when the minis are a real sequence (steps) — renders an <ol>. */
  ordered?: boolean;
  /** Flip media to the right on wide screens. */
  reverse?: boolean;
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { FeatureSpotlight } from "../src/kit/blocks/marketing/feature-spotlight";
import { BookOpen, Sparkles, Zap } from "lucide-react";
export function FeatureSpotlightUsageExample() {
  return (
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
  );
}`,
  },
  "scroll-reveal": {
    props: `import type { ReactNode } from "react";

export function ScrollReveal({
  as = "div",
  children,
  className,
  delay = 0,
}: {
  /** Rendered element — pick "li"/"article"/"section" to keep list and landmark markup valid. */
  as?: "div" | "li" | "article" | "section" | "header";
  children: ReactNode;
  className?: string | undefined;
  /** Stagger offset in ms for grouped reveals. */
  delay?: number;
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { ScrollReveal } from "../src/kit/blocks/marketing/scroll-reveal";
export function ScrollRevealUsageExample() {
  return (
    <ScrollReveal>
      <div
        style={{
          background: "var(--raised)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-card, 16px)",
          padding: "1.5rem",
        }}
      >
        Wrap below-fold content in <code>ScrollReveal</code> — it rises and
        fades in once on entry, then stays. No-JS and reduced-motion visitors
        always see the content.
      </div>
    </ScrollReveal>
  );
}`,
  },
  "logo-strip": {
    props: `import type { ReactNode } from "react";

export function LogoStrip({
  label,
  marquee = false,
  children,
}: {
  label?: string | undefined;
  marquee?: boolean | undefined;
  children: ReactNode;
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { LogoStrip } from "../src/kit/blocks/marketing/logo-strip";
export function LogoStripUsageExample() {
  return (
    <LogoStrip label="Trusted by teams at">
      {["Northwind", "Acme", "Globex", "Initech", "Umbrella"].map((name) => (
        <span key={name} style={{ fontWeight: 600, fontSize: "0.95rem" }}>
          {name}
        </span>
      ))}
    </LogoStrip>
  );
}`,
  },
  "testimonial-grid": {
    props: `import type { ReactNode } from "react";

export type Testimonial = {
  quote: string;
  name: string;
  /** Role/company line, e.g. "CTO, Acme". */
  detail?: string | undefined;
  /** Optional avatar/initials slot. */
  avatar?: ReactNode | undefined;
  profileUrl?: string | undefined;
  rating?: number | undefined;
  lang?: string | undefined;
};

export function TestimonialGrid({
  id,
  eyebrow,
  heading,
  intro,
  items,
  featuredIndex,
  ratingLabel = "{rating} out of 5 stars",
}: {
  id?: string | undefined;
  eyebrow?: string | undefined;
  heading?: string | undefined;
  intro?: string | undefined;
  items: readonly Testimonial[];
  featuredIndex?: number | undefined;
  ratingLabel?: string | undefined;
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { TestimonialGrid } from "../src/kit/blocks/marketing/testimonial-grid";
import { UserRound } from "lucide-react";
export function TestimonialGridUsageExample() {
  return (
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
  );
}`,
  },
  "faq-accordion": {
    props: `export type FaqItem = {
  question: string;
  answer: string;
};

export function FaqAccordion({ items }: { items: readonly FaqItem[] })`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { FaqAccordion } from "../src/kit/blocks/marketing/faq-accordion";
export function FaqAccordionUsageExample() {
  return (
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
          answer:
            "Native details/summary keeps it accessible without JavaScript.",
          question: "What about no-JS visitors?",
        },
      ]}
    />
  );
}`,
  },
  "newsletter-band": {
    props: `import type { ReactNode } from "react";

export function NewsletterBand({
  title,
  description,
  children,
}: {
  title: string;
  description?: string | undefined;
  /** Form slot — typically an inline email input + submit button. */
  children: ReactNode;
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { NewsletterBand } from "../src/kit/blocks/marketing/newsletter-band";
export function NewsletterBandUsageExample() {
  return (
    <NewsletterBand
      description="One honest line about what subscribers get and how often."
      title="Get product updates"
    >
      <form action="#">
        <input aria-label="Email" placeholder="you@example.com" type="email" />
        <button type="submit">Subscribe</button>
      </form>
    </NewsletterBand>
  );
}`,
  },
  "waitlist-band": {
    props: `import type { ReactNode } from "react";

export function WaitlistBand({
  title,
  description,
  kicker,
  status,
  shareUrl,
  shareLabel = "Your invite link",
  children,
}: {
  title: string;
  description?: string | undefined;
  kicker?: string | undefined;
  /** Redirect-back status line — rendered with role="status". */
  status?: ReactNode;
  /** Shareable referral URL shown after a successful join. */
  shareUrl?: string | undefined;
  shareLabel?: string | undefined;
  /** Form slot — typically an inline email input + submit button. */
  children: ReactNode;
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { WaitlistBand } from "../src/kit/blocks/marketing/waitlist-band";
export function WaitlistBandUsageExample() {
  return (
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
  );
}`,
  },
  "cta-band": {
    props: `export function CtaBand({
  title,
  text,
  cta,
}: {
  title: string;
  text?: string | undefined;
  cta: { href: string; label: string };
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { CtaBand } from "../src/kit/blocks/marketing/cta-band";
export function CtaBandUsageExample() {
  return (
    <CtaBand
      cta={{ href: "#", label: "Join the waitlist" }}
      text="One clear next step at the end of the page."
      title="Ready when you are"
    />
  );
}`,
  },
  "ambient-background": {
    props: `export type AmbientKind = "globe" | "rails" | "grid" | "constellation" | "matrix";

export function AmbientBackground({
  kind,
  pauseLabel = "Pause background animation",
  playLabel = "Play background animation",
}: {
  kind: AmbientKind;
  pauseLabel?: string;
  playLabel?: string;
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { AmbientBackground } from "../src/kit/blocks/marketing/ambient-background";
export function AmbientBackgroundUsageExample() {
  return <AmbientBackground kind="globe" />;
}`,
  },
  "product-grid": {
    props: `export type ProductCard = {
  name: string;
  description?: string | undefined;
  price: string;
  /** Optional image; falls back to a token-tinted monogram tile. */
  image?: { src: string; alt: string } | undefined;
  href?: string | undefined;
  badge?: string | undefined;
};

export function ProductGrid({
  heading,
  sub,
  products,
  ctaLabel = "View",
}: {
  heading?: string | undefined;
  sub?: string | undefined;
  products: readonly ProductCard[];
  ctaLabel?: string | undefined;
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { ProductGrid } from "../src/kit/blocks/marketing/product-grid";
export function ProductGridUsageExample() {
  return (
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
      sub="Cards for a shop or catalog landing — images optional."
    />
  );
}`,
  },
  "changelog-timeline": {
    props: `export type ChangelogItem = {
  /** Bold lead line for roadmap-style upcoming work. */
  title: string;
  /** Muted paragraph under the item title. */
  body: string;
};

export type ChangelogEntry = {
  /** Rail top line — release date ("Sep 18, 2026") or a roadmap eyebrow ("Coming soon"). */
  meta: string;
  /** Rail secondary lines — framework tags or a kind label like "Roadmap". */
  tags?: readonly string[] | undefined;
  /** Pill above the title — e.g. "Latest". */
  badge?: string | undefined;
  /** Entry heading — release name or "Work in progress". */
  title: string;
  /** Accent kind line under the title — "New", "Improved", "Fixed". */
  kind?: string | undefined;
  /** Intro paragraph between the title and the change list. */
  summary?: string | undefined;
  /** Bullet list of shipped changes. */
  points?: readonly string[] | undefined;
  /** Titled paragraphs — roadmap-style upcoming items. */
  items?: readonly ChangelogItem[] | undefined;
  /** Trailing muted line — e.g. "… and smaller fixes". */
  more?: string | undefined;
  /** Marks the entry as not-yet-shipped — the timeline dot stays a hollow accent ring. */
  upcoming?: boolean | undefined;
};

export function ChangelogTimeline({ entries }: { entries: readonly ChangelogEntry[] })`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { ChangelogTimeline } from "../src/kit/blocks/marketing/changelog-timeline";
export function ChangelogTimelineUsageExample() {
  return (
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
  );
}`,
  },
  "product-frame": {
    props: `import type { ReactNode } from "react";

export type ProductFrameTab = {
  label: string;
  /** Marks the tab as the current view (hairline ring + ink text). */
  active?: boolean | undefined;
};

export function ProductFrame({
  url,
  chrome = "browser",
  brand,
  tabs,
  status,
  children,
  className,
}: {
  /** Optional URL shown in the chrome pill (browser chrome only). */
  url?: string | undefined;
  /** "browser" = fake browser bar; "app" = flat app-window titlebar. */
  chrome?: "browser" | "app" | undefined;
  /** Leading slot in the app titlebar — e.g. a small product mark + wordmark. */
  brand?: ReactNode;
  /** Segmented nav strip in the app titlebar; \`active\` marks the open view. */
  tabs?: readonly ProductFrameTab[] | undefined;
  /** Status strip rendered at the bottom edge of the frame. */
  status?: ReactNode;
  children: ReactNode;
  className?: string | undefined;
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/minimal-showcase.tsx
import { ProductFrame } from "../src/kit/blocks/marketing/product-frame";
export function ProductFrameUsageExample() {
  return (
    <ProductFrame url="app.acme.dev/settings">
      <div>
        <p>
          <strong>Buffer:</strong> 10 min
        </p>
        <p>
          <strong>Working hours:</strong> 09:00–17:00
        </p>
        <p>
          <strong>Meeting limit:</strong> 6
        </p>
        <p>
          <strong>Reminders:</strong> Email + calendar
        </p>
      </div>
    </ProductFrame>
  );
}`,
  },
  "hero-product": {
    props: `import type { ReactNode } from "react";

import type { ProductFrameTab } from "./product-frame";

export function HeroProduct({
  eyebrow,
  title,
  titleBreak,
  lede,
  primary,
  secondary,
  product,
  productUrl,
  chrome = "browser",
  productBrand,
  productTabs,
  productStatus,
  titleId,
}: {
  eyebrow?: string | undefined;
  title: string;
  /** Optional second headline line, forced onto its own line. */
  titleBreak?: string | undefined;
  lede: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string } | undefined;
  /** Product UI rendered inside the elevated frame — pass real markup. */
  product?: ReactNode;
  /** URL shown in the frame's chrome pill (browser chrome only). */
  productUrl?: string | undefined;
  /** Frame chrome: "browser" (default) or "app" (flat titlebar). */
  chrome?: "browser" | "app" | undefined;
  /** Leading brand slot in the app titlebar — mark + wordmark. */
  productBrand?: ReactNode;
  /** Segmented tab strip in the app titlebar. */
  productTabs?: readonly ProductFrameTab[];
  /** Status strip rendered at the bottom edge of the frame. */
  productStatus?: ReactNode;
  /** Heading id for aria-labelledby — override when more than one hero is on a page. */
  titleId?: string | undefined;
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/minimal-showcase.tsx
import { HeroProduct } from "../src/kit/blocks/marketing/hero-product";
export function HeroProductUsageExample() {
  return (
    <HeroProduct
      eyebrow="Scheduling for small teams"
      lede="One line that says what the product does — the product window below does the convincing."
      primary={{ href: "#", label: "Get started" }}
      product={
        <div>
          <p>Buffer · 10 min</p>
          <p>Working hours: 09:00–17:00</p>
          <p>Meeting limit: 6</p>
        </div>
      }
      productUrl="app.acme.dev/settings"
      secondary={{ href: "#", label: "See it live" }}
      title="Bookings that"
      titleBreak="run themselves."
    />
  );
}`,
  },
  "steps-ruled": {
    props: `import type { ReactNode } from "react";

export type RuledStep = {
  /** Decorative icon (lucide at the call site) — rendered in --accent. */
  icon?: ReactNode;
  title: string;
  text: string;
};

export function StepsRuled({
  eyebrow,
  title,
  sub,
  steps,
}: {
  eyebrow?: string | undefined;
  title: string;
  sub?: string | undefined;
  steps: readonly RuledStep[];
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/minimal-showcase.tsx
import { StepsRuled } from "../src/kit/blocks/marketing/steps-ruled";
import { Link2, PenLine, Search } from "lucide-react";
export function StepsRuledUsageExample() {
  return (
    <StepsRuled
      eyebrow="How it works"
      steps={[
        {
          icon: <Search />,
          text: "Connect and Acme reads availability only.",
          title: "Connect",
        },
        {
          icon: <PenLine />,
          text: "Buffers and limits in one place.",
          title: "Set rules",
        },
        {
          icon: <Link2 />,
          text: "One link does all the work.",
          title: "Share",
        },
      ]}
      sub="Three steps, then it runs itself."
      title="From setup to hands-off."
    />
  );
}`,
  },
  "feature-story": {
    props: `import type { ReactNode } from "react";

export type StoryPoint = {
  icon?: ReactNode;
  title: string;
  text: string;
};

export type StoryRow = {
  title: string;
  text: string;
  /** Mini points — up to 3 render in a row under the copy. */
  points?: readonly StoryPoint[];
  /** Product vignette — rendered flat as a hairline-ruled region. */
  media?: ReactNode;
  /** Optional frame header label (e.g. "To approve") with an optional right-hand meta. */
  mediaLabel?: string;
  mediaMeta?: string;
};

export function FeatureStory({ rows }: { rows: readonly StoryRow[] })`,
    usage: `// Shipped example: apps/web/app/kit-blocks/minimal-showcase.tsx
import { FeatureStory } from "../src/kit/blocks/marketing/feature-story";
import { Check, Mail } from "lucide-react";
export function FeatureStoryUsageExample() {
  return (
    <FeatureStory
      rows={[
        {
          points: [
            {
              icon: <Check />,
              text: "Nothing books without you.",
              title: "Review mode",
            },
            {
              icon: <Mail />,
              text: "Confirmations send themselves.",
              title: "Auto-confirm",
            },
          ],
          text: "Every booking can wait in a review queue — glance, edit, or confirm before it lands.",
          title: "Approve every booking, or none.",
        },
      ]}
    />
  );
}`,
  },
  "comparison-ruled": {
    props: `export type ComparisonRow = {
  /** Dimension name — e.g. "Who it finds". */
  label: string;
  /** The incumbent / typical answer, rendered muted. */
  them: string;
  /** Your product's answer, rendered strong with an accent check. */
  us: string;
};

export function ComparisonRuled({
  columns,
  rows,
  eyebrow,
  title,
  sub,
}: {
  /** [dimension, them, us] column headers — dimension may be "". */
  columns: readonly [string, string, string];
  rows: readonly ComparisonRow[];
  eyebrow?: string | undefined;
  title: string;
  sub?: string | undefined;
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/minimal-showcase.tsx
import { ComparisonRuled } from "../src/kit/blocks/marketing/comparison-ruled";
export function ComparisonRuledUsageExample() {
  return (
    <ComparisonRuled
      columns={["", "Typical schedulers", "Acme"]}
      eyebrow="Why us"
      rows={[
        { label: "Setup", them: "Forms and embeds", us: "One link per person" },
        {
          label: "Back-and-forth",
          them: "Still on you",
          us: "Handled end to end",
        },
      ]}
      sub="Same job, different tool."
      title="Schedulers automate the link."
    />
  );
}`,
  },
  "pricing-panel": {
    props: `export type PricingTier = {
  name: string;
  /** Price string or a placeholder like "Coming soon". */
  price: string;
  description: string;
  features: readonly string[];
  cta: { href: string; label: string };
  recommended?: boolean | undefined;
  /** Label shown in accent on the recommended column — e.g. "Recommended". */
  recommendedLabel?: string | undefined;
};

export function PricingPanel({
  eyebrow,
  title,
  sub,
  tiers,
}: {
  eyebrow?: string | undefined;
  title: string;
  sub?: string | undefined;
  tiers: readonly PricingTier[];
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/minimal-showcase.tsx
import { PricingPanel } from "../src/kit/blocks/marketing/pricing-panel";
export function PricingPanelUsageExample() {
  return (
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
  );
}`,
  },
  "faq-split": {
    props: `export type FaqSplitItem = {
  q: string;
  a: string;
};

export function FaqSplit({
  title,
  sub,
  items,
  defaultOpen,
  name,
}: {
  title: string;
  sub?: string | undefined;
  items: readonly FaqSplitItem[];
  /** Index of the item rendered open — e.g. 0 opens the first. */
  defaultOpen?: number | undefined;
  /** Set to share a name across items — native exclusive accordion:
     opening one closes the others (Chrome 120+, Safari 17.2+, FF 130+;
     older engines degrade to independent toggles). */
  name?: string | undefined;
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/minimal-showcase.tsx
import { FaqSplit } from "../src/kit/blocks/marketing/faq-split";
export function FaqSplitUsageExample() {
  return (
    <FaqSplit
      defaultOpen={0}
      items={[
        {
          a: "Availability only — event contents are never read.",
          q: "Does Acme read my whole calendar?",
        },
        {
          a: "Reschedule links move events inside your rules.",
          q: "What about reschedules?",
        },
        {
          a: "Yes — review mode keeps every booking pending.",
          q: "Can I approve manually?",
        },
      ]}
      sub="The short version, honestly answered."
      title="Questions, answered."
    />
  );
}`,
  },
  "cta-form": {
    props: `import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

function CtaFormBase({
  title,
  sub,
  children,
  note,
}: {
  title: string;
  sub?: string | undefined;
  children: ReactNode;
  note?: string | undefined;
})

function CtaInput(props: InputHTMLAttributes<HTMLInputElement>)

function CtaButton({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>)

function CtaLink({ children, href }: { children: ReactNode; href: string })

CtaForm = Object.assign(CtaFormBase, {
  Input: CtaInput,
  Button: CtaButton,
  Link: CtaLink,
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/minimal-showcase.tsx
import { CtaForm } from "../src/kit/blocks/marketing/cta-form";
export function CtaFormUsageExample() {
  return (
    <CtaForm
      note="We invite new accounts in weekly waves."
      sub="Reserve a link and we'll open your account in the next wave."
      title="Put scheduling on autopilot."
    >
      <form>
        <CtaForm.Input
          aria-label="Email"
          placeholder="you@example.com"
          type="email"
        />
        <CtaForm.Button>Join the waitlist</CtaForm.Button>
      </form>
    </CtaForm>
  );
}`,
  },
  "chart-line": {
    props: `export type LinePoint = {
  /** X-axis label — row header in the visually-hidden data table. */
  label: string;
  /** Numeric value plotted on the data-scaled y-axis. */
  value: number;
};

export function ChartLine({
  label,
  points,
  tone = "primary",
}: {
  /** Chart name — visible caption, table caption, and aria-label prefix. */
  label: string;
  /** Series points in x order. An empty series renders a muted "no data" note. */
  points: readonly LinePoint[];
  /** "primary" strokes --accent; "muted" strokes --muted for quieter context. */
  tone?: "primary" | "muted" | undefined;
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { ChartLine } from "../src/kit/blocks/marketing/chart-line";
export function ChartLineUsageExample() {
  return (
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
  );
}`,
  },
  "stat-grid": {
    props: `export type StatItem = {
  label: string;
  value: string;
  hint?: string | undefined;
};

export function StatGrid({ items }: { items: readonly StatItem[] })`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { StatGrid } from "../src/kit/blocks/app/stat-grid";
export function StatGridUsageExample() {
  return (
    <StatGrid
      items={[
        { hint: "+12% vs last week", label: "Active users", value: "1,248" },
        { hint: "Last 30 days", label: "Revenue", value: "$4.2k" },
        { hint: "p95 across regions", label: "Latency", value: "84ms" },
      ]}
    />
  );
}`,
  },
  "data-table": {
    props: `import type { ReactNode } from "react";

export type DataTableColumn = {
  key: string;
  label: string;
  /** Renders end-aligned for numbers/amounts. */
  align?: "start" | "end" | undefined;
};

export type DataTableRow = {
  key: string;
  cells: Readonly<Record<string, ReactNode>>;
};

export function DataTable({
  caption,
  columns,
  rows,
  emptyMessage = "No records yet.",
}: {
  caption?: string | undefined;
  columns: readonly DataTableColumn[];
  rows: readonly DataTableRow[];
  emptyMessage?: string | undefined;
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { DataTable } from "../src/kit/blocks/app/data-table";
export function DataTableUsageExample() {
  return (
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
  );
}`,
  },
  "empty-state": {
    props: `import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  /** Caller-supplied icon (e.g. a lucide-react glyph with aria-hidden). */
  icon?: ReactNode | undefined;
  title: string;
  text?: string | undefined;
  action?: { href: string; label: string } | undefined;
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { EmptyState } from "../src/kit/blocks/app/empty-state";
import { Inbox } from "lucide-react";
export function EmptyStateUsageExample() {
  return (
    <EmptyState
      action={{ href: "#", label: "Create your first project" }}
      icon={<Inbox />}
      text="When you add something, it shows up here with status and activity."
      title="Nothing here yet"
    />
  );
}`,
  },
  "choice-pills": {
    props: `export type ChoicePillsOption = {
  value: string;
  label: string;
};

export function ChoicePills({
  legend,
  name,
  options,
  value,
  defaultValue,
  onChange,
}: {
  /** Group label rendered as the fieldset legend. */
  legend: string;
  name: string;
  options: readonly ChoicePillsOption[];
  /** Controlled selection — pair with \`onChange\`. */
  value?: string | undefined;
  /** Initial selection for uncontrolled usage (no React state needed). */
  defaultValue?: string | undefined;
  onChange?: ((value: string) => void) | undefined;
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { ChoicePills } from "../src/kit/blocks/app/choice-pills";
export function ChoicePillsUsageExample() {
  return (
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
  );
}`,
  },
  skeleton: {
    props: `import type { CSSProperties } from "react";

export function Skeleton({
  width,
  height,
  radius,
  className,
}: {
  /** CSS length (e.g. "60%", 120, "8rem"). Numbers become px. */
  width?: CSSProperties["width"];
  /** CSS length (e.g. "44px", 44). Numbers become px. */
  height?: CSSProperties["height"];
  /** Corner radius override; defaults to --radius-control. */
  radius?: CSSProperties["borderRadius"];
  className?: string | undefined;
})`,
    usage: `// Shipped example: apps/web/src/web-auth-page.tsx
import { Skeleton } from "../src/kit/blocks/app/skeleton";
export function SkeletonUsageExample() {
  return <Skeleton height={28} radius={8} width="60%" />;
}`,
  },
  tooltip: {
    props: `import type { ReactNode } from "react";

export function Tooltip({
  as = "span",
  children,
  className,
  content,
  delayMs = 300,
  side = "top",
}: {
  /** Wrapper element — "span" for inline triggers, "div" around block cards. */
  as?: "span" | "div";
  children: ReactNode;
  className?: string | undefined;
  content: ReactNode;
  delayMs?: number;
  side?: "top" | "bottom";
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { Tooltip } from "../src/kit/blocks/app/tooltip";
export function TooltipUsageExample() {
  return (
    <Tooltip content="Short helper copy — never the only way to reach it.">
      <a href="#">Hover or tab here</a>
    </Tooltip>
  );
}`,
  },
  "otp-input": {
    props: `import type { Ref } from "react";

export function OtpInput({
  autoComplete = "one-time-code",
  autoFocus,
  disabled,
  id,
  label,
  length = 6,
  name,
  onChange,
  onComplete,
  ref,
  value,
}: {
  autoComplete?: string | undefined;
  autoFocus?: boolean | undefined;
  disabled?: boolean | undefined;
  /** For an external \`<label htmlFor>\`; otherwise pass \`label\`. */
  id?: string | undefined;
  /** Standalone \`aria-label\` when no external label element exists. */
  label?: string | undefined;
  /** Number of digit boxes — an even value >= 4 gets a dash mid-way. */
  length?: number | undefined;
  /** Form field name — enables native form serialization. */
  name?: string | undefined;
  onChange?: ((value: string) => void) | undefined;
  onComplete?: ((value: string) => void) | undefined;
  /** Forwarded to the real <input> (React 19 — no forwardRef needed). */
  ref?: Ref<HTMLInputElement> | undefined;
  value?: string | undefined;
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { OtpInput } from "../src/kit/blocks/app/otp-input";
export function OtpInputUsageExample() {
  return <OtpInput label="One-time code" />;
}`,
  },
  "paywall-gate": {
    props: `import type { ReactNode } from "react";

export type PaywallGateProps = {
  /** Upgrade destination. */
  cta: { href: string; label: string };
  /** Optional teaser sentence merged into the gated-content copy in the panel. */
  excerpt?: string | undefined;
  /** Entitlement/plan label shown in the prompt (e.g. "Pro"). */
  requiredTier: string;
  /** Optional faded preview content (already-safe teaser markup). */
  preview?: ReactNode | undefined;
  /** Optional heading shown in the gate panel. */
  title?: string | undefined;
};

export function PaywallGate({ cta, excerpt, preview, requiredTier, title }: PaywallGateProps)`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { PaywallGate } from "../src/kit/blocks/app/paywall-gate";
export function PaywallGateUsageExample() {
  return (
    <PaywallGate
      cta={{ href: "#", label: "Upgrade to Pro" }}
      excerpt="Pro subscribers read the full report — cohort retention, channel mix, and the margin bridge."
      requiredTier="Pro"
      title="Q3 teardown: where the growth came from"
      preview={
        <p>
          Net revenue retention held at 118% while gross margin expanded 4pts —
          the mix shift toward annual plans did most of the work…
        </p>
      }
    />
  );
}`,
  },
  "data-viz-bars": {
    props: `export type BarDatum = {
  /** X-axis label — shown under the column + row header in the hidden table. */
  label: string;
  /** Numeric value; must be ≥ 0 (negatives clamp to the baseline). */
  value: number;
};

export function DataVizBars({
  bars,
  label,
}: {
  /** Columns in x order. */
  bars: readonly BarDatum[];
  /** Chart name — visible caption, table caption, and aria-label prefix. */
  label: string;
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { DataVizBars } from "../src/kit/blocks/app/data-viz-bars";
export function DataVizBarsUsageExample() {
  return (
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
  );
}`,
  },
  "data-viz-donut": {
    props: `export type DonutSlice = {
  /** Slice name — legend row + row header in the visually-hidden data table. */
  label: string;
  /**
   * Numeric share; fractions are computed against the sum of all slices.
   * Donuts can't draw negative arcs — negative values clamp to 0 everywhere
   * they are displayed (the hidden table keeps the raw value).
   */
  value: number;
};

export function DataVizDonut({
  label,
  slices,
}: {
  /** Chart name — visible caption, table caption, and aria-label prefix. */
  label: string;
  /** Slices in display order, starting at 12 o'clock and running clockwise. */
  slices: readonly DonutSlice[];
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { DataVizDonut } from "../src/kit/blocks/app/data-viz-donut";
export function DataVizDonutUsageExample() {
  return (
    <DataVizDonut
      label="Traffic by channel"
      slices={[
        { label: "Organic", value: 46 },
        { label: "Referral", value: 27 },
        { label: "Social", value: 19 },
        { label: "Direct", value: 8 },
      ]}
    />
  );
}`,
  },
  "metric-trend": {
    props: `export function MetricTrend({
  delta,
  label,
  points,
  value,
}: {
  /**
   * Signed change chip — \`direction\` picks the icon (\`"flat"\` renders a
   * neutral \`Minus\`, no trend arrow). \`tone\` defaults to direction
   * (up→positive, down→negative, flat→neutral); override it for metrics
   * that improve when they fall (latency, churn): \`{ direction: "down",
   * tone: "positive" }\`.
   */
  delta: {
    direction: "up" | "down" | "flat";
    text: string;
    tone?: "positive" | "negative" | "neutral" | undefined;
  };
  /** Metric name shown above the value. */
  label: string;
  /** Sparkline series in x order; fewer than two points hides the spark. */
  points: readonly number[];
  /** Big formatted value (already formatted — "1,248", "$4.2k"). */
  value: string;
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { MetricTrend } from "../src/kit/blocks/app/metric-trend";
export function MetricTrendUsageExample() {
  return (
    <MetricTrend
      delta={{ direction: "up", text: "+12%" }}
      label="Active users"
      points={[4, 6, 5, 8, 7, 11, 12]}
      value="1,248"
    />
  );
}`,
  },
  "site-header": {
    props: `import type { ReactNode } from "react";

export function SiteHeader({
  brand,
  links,
  cta,
}: {
  /** Caller-supplied brand mark (logo + wordmark) wrapped in a link. */
  brand: ReactNode;
  links: readonly { href: string; label: string; active?: boolean | undefined }[];
  cta?: { href: string; label: string } | undefined;
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { SiteHeader } from "../src/kit/blocks/chrome/site-header";
import { Sparkles } from "lucide-react";
export function SiteHeaderUsageExample() {
  return (
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
  );
}`,
  },
  "site-footer": {
    props: `import type { ReactNode } from "react";

export type FooterLinkGroup = {
  title: string;
  links: readonly { href: string; label: string }[];
};

export function SiteFooter({
  brand,
  tagline,
  groups,
  legal,
  controls,
}: {
  /** Caller-supplied brand mark (logo + wordmark). */
  brand: ReactNode;
  tagline?: string | undefined;
  groups: readonly FooterLinkGroup[];
  /** Bottom line — copyright, jurisdiction, extra legal links. */
  legal?: ReactNode | undefined;
  /** Visitor controls row — e.g. language/theme menus; renders above legal. */
  controls?: ReactNode | undefined;
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { SiteFooter } from "../src/kit/blocks/chrome/site-footer";
import { Sparkles } from "lucide-react";
export function SiteFooterUsageExample() {
  return (
    <SiteFooter
      brand={
        <a
          href="#"
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
        >
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
  );
}`,
  },
  "scroll-end-cta": {
    props: `import type { ReactNode } from "react";

export type ScrollEndCtaAction = {
  href: string;
  label: string;
  /** Quieter second line inside the action row. */
  hint?: string | undefined;
};

export function ScrollEndCta({
  body,
  closeLabel = "Close",
  delayMs = 90_000,
  preview = false,
  primary,
  secondary,
  storageKey = "scroll-end-cta.shown",
  title,
}: {
  title: string;
  body: ReactNode;
  primary: ScrollEndCtaAction;
  secondary?: ScrollEndCtaAction | undefined;
  closeLabel?: string | undefined;
  /** Dwell fallback for visitors who never reach the bottom. */
  delayMs?: number | undefined;
  /** sessionStorage key recording that the dialog already appeared. */
  storageKey?: string | undefined;
  /** Inline render for the /kit-blocks gallery — no listeners or modal. */
  preview?: boolean | undefined;
})`,
    usage: `// Shipped example: apps/web/src/landing-page.tsx
import { ScrollEndCta } from "../src/kit/blocks/marketing/scroll-end-cta";

export function ScrollEndCtaUsageExample() {
  return (
    <ScrollEndCta
      body="This dialog shows once per session when a visitor reaches the end of the page. Replace it with your own follow-up — a contact link, a signup prompt, or a booking."
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
  );
}`,
  },
  "prose-page": {
    props: `import type { ReactNode } from "react";

export function ProsePage({
  title,
  updated,
  children,
}: {
  title: string;
  /** e.g. "Last updated March 2026" */
  updated?: string | undefined;
  children: ReactNode;
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { ProsePage } from "../src/kit/blocks/chrome/prose-page";
export function ProsePageUsageExample() {
  return (
    <ProsePage title="Privacy Policy" updated="Last updated March 2026">
      <h2>What we collect</h2>
      <p>
        Write plain-language sections here. The block styles h2, h3, p, lists,
        and links so legal copy stays readable without extra work.
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
  );
}`,
  },
  "feature-tabs": {
    props: `import type { LucideIcon } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

export type FeatureTabItem = {
  /** Unique slug — also seeds the tab/panel aria ids. */
  id: string;
  /** Short capability name on the tab strip. */
  label: string;
  /** Panel headline. */
  title: string;
  description: string;
  /** Bullet points under the description. */
  points: readonly string[];
  /** Marker on the tab + default media — pass an element from server components. */
  icon?: LucideIcon | ReactElement | undefined;
  /** Product visual for the panel — defaults to a ProductFrame placeholder. */
  media?: ReactNode | undefined;
};

export function FeatureTabs({
  heading,
  sub,
  label,
  items,
  defaultActiveId,
}: {
  heading?: string | undefined;
  sub?: string | undefined;
  /** Accessible name for the tab strip — defaults to \`heading\` then "Features". */
  label?: string | undefined;
  items: readonly FeatureTabItem[];
  /** Initially selected tab — defaults to the first item. */
  defaultActiveId?: string | undefined;
})`,
    usage: `// Shipped example: apps/web/app/kit-blocks/page.tsx
import { FeatureTabs } from "../src/kit/blocks/marketing/feature-tabs";
export function FeatureTabsUsageExample() {
  return (
    <FeatureTabs
      heading="What the kit covers"
      items={[
        {
          description:
            "Sessions, OAuth and roles are wired end to end, so sign-in is a configuration step.",
          id: "auth",
          label: "Auth",
          points: ["Password and magic link", "Two-factor and passkeys", "Organization roles"],
          title: "Authentication you can ship",
        },
        {
          description:
            "Checkout, webhooks and entitlements already talk to each other across providers.",
          id: "billing",
          label: "Billing",
          points: ["Subscriptions and one-time", "Per-seat quantities", "Entitlement ledger"],
          title: "Payments without plumbing",
        },
        {
          description:
            "A typed task API and provider adapters keep AI work metered and budgeted.",
          id: "ai",
          label: "AI",
          points: ["Multiple providers", "Usage budgets", "Durable task runs"],
          title: "AI features on a foundation",
        },
      ]}
    />
  );
}`,
  },
};

/** One source-backed public guide per entry in the shipped kit block registry. */
export const blockGuides: readonly Guide[] = KIT_BLOCKS.map((block): Guide => {
  const reference = blockReferences[block.id];
  if (!reference) throw new Error(`Missing block guide reference for ${block.id}`);
  const sections: readonly Section[] = [
    {
      id: "first-use",
      title: "Start here: preview and add this block",
      paragraphs: [
        "A block is a ready-made piece of a page, such as a headline section, pricing panel or chart. First complete the Web local setup, leave its server running, and open http://localhost:3000/kit-blocks in your browser. Find the block whose name matches this guide. This preview page is available during development only; a production 404 is expected.",
        "Open your project folder in the editor. The Registry source files section below gives this block's exact files. Example usage is code for a React page, not a terminal command or .env setting. Props are the values you supply to the block: text, links, data and optional display choices. A question mark in a prop declaration means that value is optional.",
        "If you use a coding agent, copy the request below into its chat with this repository open. Replace / with the route you want to change and describe your actual text, links and data. The agent should inspect the existing page before inserting the block, preserve your other content, and show you the changed files. You do not need to manually combine imports or write JSX to use this path.",
        "If you edit code yourself, use the imports and example below, adjusting the relative import path for your page. Replace demonstration text and any # links with your own content and working destinations. Do not overwrite the whole page with an isolated example; insert the component into the existing page's returned markup. Save the file and reload your local route.",
      ],
      code: `Add the ${block.id} block to my page at /.\nRead these source files first:\n${block.files.join("\n")}\nUse the documented component exports and props.\nAsk me for missing product text, link destinations or data.\nPreserve the existing page and its theme.\nConnect functional buttons/forms to real handlers; explain anything that needs server work.\nShow the local preview URL and changed files, then typecheck the Web app.`,
      links: [
        { href: "/docs/web/local-setup", label: "Start the Web preview server" },
        { href: "/docs/web/terminal-basics", label: "Learn how to open files and run commands" },
      ],
    },
    { id: "usage", title: "Example usage", paragraphs: templates.usage, code: reference.usage },
    {
      id: "props",
      title: "Export and props",
      paragraphs: [templates.props],
      code: reference.props,
    },
    {
      id: "files",
      title: "Registry source files",
      paragraphs: [templates.files],
      items: block.files,
    },
    {
      id: "composition",
      title: "Composition notes",
      paragraphs: templates.composition,
      links: [
        { href: "/docs/web/kit-blocks", label: "Block library" },
        { href: "/docs/web/theming", label: "Themes and styles" },
      ],
    },
    {
      id: "check-your-page",
      title: "Check your page and fix common mistakes",
      paragraphs: [
        "Open the route you changed and confirm the block displays your own content. Click every action, use Tab to check keyboard focus, and resize the browser to a narrow phone width. If this is an authenticated app block, complete database setup and sign in first. A visual block does not automatically save a form, collect a payment or authorize access.",
        "Run the command below in a second terminal at the repository root; keep the preview server open. Success means it finishes without TypeScript errors. Cannot find module usually means an incorrect import path; a missing prop error points to a required value listed in Export and props. Ask your agent to correct that specific error, then rerun the command and recheck the page.",
      ],
      code: "corepack pnpm --filter @supastack/web typecheck",
    },
  ];
  return {
    slug: `components/${block.id}`,
    tab: "web",
    group: groupBySurface[block.surface],
    title: block.name,
    description: block.description,
    sections,
  };
});
