export type LegalSlug = "privacy" | "terms" | "license" | "acceptable-use" | "disclaimer";

export type LegalSection = {
  heading: string;
  body: string;
  /** Optional bullet list rendered under the body — the license page's can/can't lists. */
  items?: readonly string[];
};

export type LegalDocument = {
  slug: LegalSlug;
  title: string;
  updated: string;
  sections: readonly LegalSection[];
};

export const privacyPolicy: LegalDocument = {
  slug: "privacy",
  title: "Privacy",
  updated: "2026-09-10",
  sections: [
    {
      heading: "What this covers",
      body: "This page describes how supastack handles information when you use the public website, create an account, or submit a contact or newsletter form. It is not a certification, audit report, or claim that every product built on the kit follows the same practice.",
    },
    {
      heading: "Account and workspace data",
      body: "If you sign in, we store the email and name on your account, session data, and records owned by your personal workspace. Product records such as AI usage, entitlements, billing events, and audit entries are scoped by workspaceId. Provider secrets stay on the server and are not written into logs.",
    },
    {
      heading: "Billing",
      body: "When a payment provider is configured for this product, customer, subscription, and entitlement records are stored so access can be enforced. Card details are handled by the payment provider and are not stored by this application.",
    },
    {
      heading: "Messages you send us",
      body: "Contact and newsletter forms send the details you type (name where asked, email, and message) to an operator inbox only when delivery is configured. We do not publish a subscriber count. If delivery is not connected, the form says so instead of pretending the message was mailed.",
    },
    {
      heading: "Analytics and cookies",
      body: "Server error and analytics clients may run in a deployed app when you configure them. The marketing site does not fire client-side analytics unless a browser capture SDK is enabled. If that happens, a consent banner appears first, and capture waits for an explicit accept.",
    },
    {
      heading: "What we do not claim",
      body: "We do not sell a customer list, invent testimonials, or promise a specific deletion portal beyond what you can do from account settings (name update and sign-out today). Ask via the contact form if you need a record removed from an operator inbox.",
    },
  ],
};

export const termsOfUse: LegalDocument = {
  slug: "terms",
  title: "Terms",
  updated: "2026-09-10",
  sections: [
    {
      heading: "The product",
      body: "This product is built on a modular Web + Mobile foundation. These terms cover this website and the product itself, not third-party services you configure.",
    },
    {
      heading: "Paid plans",
      body: "Plans and prices shown on this site are descriptive until checkout completes through the configured payment provider. A displayed price is not a charge.",
    },
    {
      heading: "Accounts",
      body: "Personal workspaces own user-owned records. Do not attempt to access another workspace. Native mobile purchases and restores use RevenueCat when configured, and workspace access follows server-verified entitlements. Web billing is separate.",
    },
    {
      heading: "Acceptable use",
      body: "Do not use the reference application, APIs, or forms to probe other tenants, inject secrets into logs, or present supastack marketing copy as customer proof you do not have.",
    },
  ],
};

// Keep in sync with /LICENSE.md at the repo root — it ships verbatim to
// buyer checkouts and restates these same terms.
export const licenseAgreement: LegalDocument = {
  slug: "license",
  title: "License",
  updated: "2026-09-27",
  sections: [
    {
      heading: "What the license covers",
      body: "A supastack license is a one-time purchase that grants ongoing access to this codebase and the rights described on this page. It covers use of the kit source — products you build on top of it keep their own terms, which remain yours to set.",
    },
    {
      heading: "The license grant",
      body: "supastack keeps ownership of the codebase and grants each licensee an ongoing, non-exclusive, worldwide license to use the code to create end products.",
    },
    {
      heading: "What you can do",
      body: "The license is deliberately broad inside one boundary: the products you ship are yours.",
      items: [
        "Build and ship as many end products as you like — for yourself, your company, or your clients.",
        "Sell the products you build and charge your own users however you choose.",
        "Buy on a client's behalf as a freelancer or agency, with one seat per developer who needs codebase access.",
        "Modify and extend the code inside your own private repositories.",
      ],
    },
    {
      heading: "What you can't do",
      body: "The codebase itself is the licensed product — it can't become something you pass on.",
      items: [
        "Sell, resell, redistribute, or publicly share the codebase itself — including as a starter kit, template, or repackaged boilerplate.",
        "Share your license or codebase access with anyone beyond your purchased seats.",
        "Publish the source in a public repository without written permission.",
      ],
    },
    {
      heading: "Seats and revocation",
      body: "Each developer with codebase access needs their own seat; the end users of products you ship never count as seats. Breaking these terms can revoke the license with no refund, and repository access is removed.",
    },
    {
      heading: "Questions",
      body: "If you are unsure how the license applies to your case — agency work, a client handover, or something else — ask through the contact form before you buy.",
    },
  ],
};

export const acceptableUsePolicy: LegalDocument = {
  slug: "acceptable-use",
  title: "Acceptable use",
  updated: "2026-09-27",
  sections: [
    {
      heading: "What this covers",
      body: "This policy applies to this website and the product built on it — accounts, forms, APIs, and every surface they expose. It exists to keep the service safe for users and to prevent it from becoming a vehicle for abuse.",
    },
    {
      heading: "Fair use",
      body: "Use the site and services as they are meant to be used. Forms and public endpoints may be rate-limited; scripted or excessive traffic that degrades the service for others can be throttled or blocked.",
    },
    {
      heading: "Your account and your users",
      body: "You are responsible for what happens under your account — including anyone you grant access to and, where the law allows it, anyone who gains access because your credentials were not reasonably secured.",
    },
    {
      heading: "Prohibited activity",
      body: "Do not use this product — the site, the APIs, or any surface — for any of the following:",
      items: [
        "Unlawful or infringing material — content that violates applicable law, intellectual-property rights you don't hold, export controls, or that is defamatory or an illegal threat.",
        "Spam and unconsented messaging — unsolicited bulk or commercial messages, purchased contact lists, or any messaging list that is not confirmed opt-in.",
        "Malicious or deceptive activity — probing or attacking infrastructure, introducing malware, accessing accounts or data you are not authorized for, evading payment, or misrepresenting affiliation with this product.",
        "Harassment and harm — hate speech, incitement to violence, content that exploits or endangers anyone, or discrimination against any group or individual.",
      ],
    },
    {
      heading: "Enforcement",
      body: "If you or your users break this policy, access can be suspended or terminated and content removed. Where the law requires it, activity may be reported to the relevant authorities. No credit or refund is owed for interruptions that result from a violation.",
    },
    {
      heading: "Changes to this policy",
      body: "This is not an exhaustive list of unacceptable activity. This policy may be revised by publishing the updated version on this page; for existing accounts it takes effect 30 days after publication, or on your next use of the service, whichever comes first.",
    },
    {
      heading: "Questions",
      body: "If you are unsure whether something is allowed, ask through the contact form before you do it.",
    },
  ],
};

export const disclaimer: LegalDocument = {
  slug: "disclaimer",
  title: "Disclaimer",
  updated: "2026-09-27",
  sections: [
    {
      heading: "General information only",
      body: "Everything on this website — marketing pages, documentation, blog posts, and pricing — is provided for general information. It is not legal, tax, accounting, or other professional advice, and it is no substitute for consulting a qualified adviser about your own situation.",
    },
    {
      heading: "No warranties",
      body: 'The site and its content are provided "as is" and "as available", without warranty of any kind, express or implied — including merchantability, fitness for a particular purpose, and non-infringement. There is no warranty that the site is error-free, uninterrupted, or free of harmful components.',
    },
    {
      heading: "Accuracy and changes",
      body: "Content is kept as current as practical, but errors and omissions happen and the legal and technical landscape shifts. Content may be added, changed, or removed at any time without notice, and there is no responsibility for results obtained from relying on outdated or inaccurate information.",
    },
    {
      heading: "External links",
      body: "The site links to third-party websites that are not operated here. There is no control over, and no guarantee of, the accuracy, relevance, or availability of anything on those sites.",
    },
    {
      heading: "Views and fair use",
      body: "Opinions in blog posts, documentation, and user comments belong to their authors and do not necessarily reflect this product's position. Copyrighted material may appear here for commentary, teaching, or review under fair-use principles — using it beyond that requires the owner's permission. Comments are the sole responsibility of their authors and may be removed at our discretion.",
    },
    {
      heading: "Use at your own risk",
      body: "Any decision or action you take based on this site's content is yours alone. To the extent permitted by law, there is no liability for damages — direct, indirect, incidental, or consequential — arising from use of, or inability to use, the site or its content.",
    },
    {
      heading: "Questions",
      body: "If anything here is unclear, ask through the contact form.",
    },
  ],
};

const documents: Record<LegalSlug, LegalDocument> = {
  privacy: privacyPolicy,
  terms: termsOfUse,
  license: licenseAgreement,
  "acceptable-use": acceptableUsePolicy,
  disclaimer,
};

export function legalDocument(slug: LegalSlug): LegalDocument {
  return documents[slug];
}
