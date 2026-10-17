# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Primary users are product builders starting an AI-powered SaaS. They need identity, billing, AI, jobs, and transactional email in place before they write product-specific features. End customers of products built on the kit are not the primary audience of this repository.

## Product Purpose

supastack is a modular Web + Mobile foundation so a team can configure existing modules instead of rebuilding common infrastructure. Success is a builder shipping product-specific features on a configured foundation, not another copy of the same application.

## Positioning

This repository provides reusable application modules and neutral demo surfaces. Builders replace the sample brand and content, configure the modules they need, and add their product-specific features.

## Operating Context

Builders evaluate the public marketing site, then a local or production reference path. Web is Next.js; iOS and Android are Expo. Every user still receives a personal workspace on signup. Organization workspaces (invites, owner/admin/member roles, active-workspace switching) are first-class foundation modules so a product can match multi-tenant SaaS flows with light UI. Local golden-path and fake/local adapters remain the credential-free acceptance gate. Real AI, email, Stripe, and Trigger.dev smoke are opt-in and not claimed by default. The public site ships a neutral landing composed from the kit block library plus `/faq`, `/pricing` (redirects to the landing pricing section), `/blog`, `/docs`, and legal/contact scaffolds for products to restyle or replace.

## Capabilities and Constraints

Confirmed:

- Next.js web and Expo mobile apps.
- Selectable auth engine — Better Auth (default: Email OTP, password, magic link, OAuth, 2FA, passkeys, admin impersonation/bans, expo) or Auth.js v5 beta (`AUTH_PROVIDER=authjs`: JWT sessions, shared `user` table, same OAuth env config, credentials reuse existing password hashes).
- Personal and organization workspaces scoped by `workspaceId`.
- Billing on web via Stripe, Lemon Squeezy, Creem, Polar, Whop, Paddle, Dodo Payments, **or** PayPal (`BILLING_PROVIDER`, per-seat quantities, monthly/yearly intervals, signed idempotent webhooks).
- Entitlements with a reusable `<EntitlementGate>`.
- Configurable AI providers with encrypted BYOK and usage budgets.
- Trigger.dev jobs through a narrow enqueue/status/cancel contract plus durable cron schedules (shipped workspace example: `email.digest`, a periodic digest of published content entries).
- Transactional email separate from outreach with branded HTML templates.
- Platform admin (users/orgs/impersonation/bans/orders/flags/announcements); audit log; workspace API keys + outbound signed webhooks; GDPR export and session management.
- Workspace CMS at `/content` — typed content entries (post/page/doc/report) with draft/published/archived workflow, optional per-entry entitlement gating by plan key (e.g. `ai.reference-task`), slug unique per (workspace, type), authored entries included in GDPR export.
- Workspace commerce at `/commerce` — products (draft/active/archived, minor-unit pricing, optional tracked inventory) and orders with a forward-only pending→paid→fulfilled lifecycle plus cancel (restocks) and refund, order items, customer email, server-computed totals, and `commerce.order_*` webhook events (`content.published` on publish); management gated to owner/admin.
- Appearance library: 21 color packs + `data-density`/`data-radius`/`data-font`/`data-layout`/`data-toast-style` axes and bundled `STYLE_CATALOG` looks, previewed in Settings → Appearance; copyable token-only kit blocks across marketing/app/chrome surfaces browsable at dev-only `/kit-blocks`.
- Rate limiting + `/api/health` + `/status`; docs search + ⌘K; notification→email delivery; Dockerfile + Compose self-hosting; observability.

Constraints: provider secrets stay server-only; mobile does not expose Stripe Checkout (RevenueCat scaffolded behind the paywall boundary); do not represent Trigger.dev as freely replaceable; no DRM or customer-production kill switch; five-provider OAuth smoke remains an external acceptance item. Organization roles (owner / admin / member) plus platform-wide admin access control are shipped and gate `/admin`.

WCAG certification is undecided.

## Brand Commitments

Shipped default brand name: supastack (a demo brand — products rename it via `siteConfig` and their own mark). This is a boilerplate demo, so every public surface uses neutral, replaceable sample content. Never import a seller's real headline, tagline, promotional copy, customer quotes, identities, avatars, trust counts, setup-time claims, or benchmarks. The default landing has no testimonials or customer proof; sample pricing is explicitly illustrative. Reusable testimonial blocks are available only as components with fictional examples in the dev gallery. Voice is factual and specific. Default marketing surface: black theme; existing type pairing; text-only chrome without built-in logo artwork. Required native icon files are blank placeholders for product customization. Motion explains hierarchy, state, or product relationships: a brief authored refresh entrance and interaction feedback. No traveling tiles, repeated section reveals, fake demo UIs, or video-player placeholders.

Product builders restyle **app** chrome (with marketing inheritance or explicit product overrides) through Settings appearance: color packs in `catalog.ts`, plus density / radius / font presets — see `docs/design/ui-appearance.md`.

## Evidence on Hand

The landing page presents generic application examples, an actual sample waitlist form, illustrative pricing, and setup documentation. It ships no customer testimonials, portrait assets, trust counts, or setup-time estimates. Local browser golden-path and fake/local tests exist; real-provider and real-device acceptance are not on hand. Do not add customer proof, case studies, benchmarks, or promises of a completed production integration to fill sample sections.

## Product Principles

- Configure modules; do not fork Starter Core into a single product.
- Keep product-specific code outside the foundation.
- Prefer honest absence over simulated proof.
- Workspace scope and server-only secrets are non-negotiable.
- Native surfaces follow the host OS; the marketing site does not set iOS or Android chrome.

## Accessibility & Inclusion

Marketing and web UI must remain usable with reduced motion, keyboard only, a 320px width, and without JavaScript for essential reading. Native surfaces honor platform Reduce Motion / Remove animations and minimum hit targets (44pt iOS, 48dp Android). No product-specific assistive-technology certification is recorded.
