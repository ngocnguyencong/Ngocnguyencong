import type { Guide, Section } from "./content";

type ProviderDefinition = Readonly<{
  slug: string;
  group: string;
  title: string;
  description: string;
  setup: readonly string[];
  setupCode: string;
  connect: readonly string[];
  connectCode?: string;
  verify: readonly string[];
  providerLinks: NonNullable<Section["links"]>;
  setupNote?: string;
  relatedLinks: NonNullable<Section["links"]>;
}>;

const environmentLink = {
  href: "/docs/reference/environment",
  label: "Environment variables",
  description: "Check the supported keys, defaults, and production requirements.",
} as const;

const databaseLink = {
  href: "/docs/web/database",
  label: "Prepare real accounts with PostgreSQL",
  description:
    "Start PostgreSQL and apply migrations before testing signed-in accounts, persistent data, or real provider flows.",
} as const;

const billingLinks = [
  {
    href: "/docs/modules/billing-configuration",
    label: "Billing lifecycle",
    description: "Read how checkout, webhooks, and provider events update billing state.",
  },
  {
    href: "/docs/modules/entitlements",
    label: "Entitlement checks",
    description: "Use the workspace entitlement ledger for paid access decisions.",
  },
  {
    href: "/docs/security/secrets",
    label: "Secrets and redaction",
    description: "Keep tokens server-only and prevent credentials from reaching logs.",
  },
] as const;

const emailLinks = [
  {
    href: "/docs/modules/email-configuration",
    label: "Transactional email",
    description: "Configure the shared sender and understand its message contract.",
  },
  {
    href: "/docs/modules/jobs",
    label: "Background jobs",
    description: "Configure local or Trigger.dev job execution independently.",
  },
] as const;

const aiLinks = [
  {
    href: "/docs/modules/ai-configuration",
    label: "AI provider configuration",
    description: "Catalog models, aliases, prices, and provider selection.",
  },
  {
    href: "/docs/modules/agent-frameworks",
    label: "Agent frameworks",
    description: "Select a server-side agent runner while reusing workspace tools.",
  },
  {
    href: "/docs/modules/openrouter",
    label: "OpenRouter",
    description: "Configure OpenRouter separately when routing catalog models through it.",
  },
] as const;

const authLinks = [
  {
    href: "/docs/modules/sessions",
    label: "Sessions and account security",
    description: "Review session lifetime, account linking, and access recovery.",
  },
  {
    href: "/docs/security/secrets",
    label: "Secrets and redaction",
    description: "Keep tokens server-only and prevent credentials from reaching logs.",
  },
] as const;

const commonWebSetup = [
  "Open a terminal at the repository root. On a first checkout, install the workspace dependencies once with `corepack pnpm install`, then start Web with `corepack pnpm --filter @supastack/web dev` and leave that terminal open. When it prints `Ready`, visit `http://localhost:3000/ai` in your browser. This local reference demo works without PostgreSQL.",
  "Use `/ai` only for the no-database reference screen. Real sign-in at `/auth`, workspace data, authenticated checkout, account email flows, and real AI requests need PostgreSQL and applied migrations. Follow the database guide before testing those flows.",
  "Next.js reads Web settings from `apps/web/.env.local`, a plain-text file of `NAME=value` lines. Create it from the root example with PowerShell `Copy-Item .env.example apps/web/.env.local` or macOS/Linux `cp .env.example apps/web/.env.local`. If that file already exists, edit it instead of replacing it.",
  "Only the `NAME=value` lines in the setup code block belong in `apps/web/.env.local`. Callback and webhook URLs appear in the Connect section; register those in the provider dashboard instead of pasting them into this file.",
  "In `apps/web/.env.local`, replace only the placeholder text to the right of each equals sign in the sample below. Never type the angle-bracket placeholders as literal values. These values belong to the server: do not put them in browser code, mobile environment variables, screenshots, logs, or a commit.",
  "Use the provider dashboard link to create the account, project, key, product, domain, or OAuth app. Use a text editor to change `apps/web/.env.local`, and use the terminal to run commands. The repository already contains the integration code, so you do not need to edit application source for this setup.",
  "After saving `apps/web/.env.local`, stop the running server with `Ctrl+C` and run `corepack pnpm --filter @supastack/web dev` again from the repository root. The server reads changed values when it starts.",
] as const;

const providerDashboardLink = (href: string) => ({
  href,
  label: "Open provider dashboard",
  description:
    "Create the provider account or app and locate the credentials and settings used in this guide.",
});

const providerDocsLink = (href: string) => ({
  href,
  label: "Read the official setup guide",
  description:
    "Follow the provider's current instructions for credentials, test mode, products, domains, or callback URLs.",
});

const smtpReferenceLink = {
  href: "https://www.rfc-editor.org/rfc/rfc5321",
  label: "Read the SMTP standard",
  description:
    "SMTP is a shared mail protocol; your chosen mail host supplies its own account, server, and login settings.",
} as const;

const compatibleApiLink = {
  href: "https://ai-sdk.dev/providers/openai-compatible-providers",
  label: "Read the compatibility guide",
  description:
    "See which API base URL and model details an OpenAI-compatible service must provide.",
} as const;

const billingSetup = [
  "Select one adapter with `BILLING_PROVIDER` and configure its server-side credentials and default provider price or product ID.",
  "Select this adapter with `BILLING_PROVIDER` in the sample below. Start in the provider's test or sandbox mode, create a product and a price, variant, or plan, then copy the exact IDs shown by the provider into the matching rows. The code sample lists the real environment-variable names this app reads.",
  "The API credential lets the server call the provider. A webhook signing secret is a separate value used to check inbound notifications; copy it from the webhook settings, not from the API-key page. Keep the credential, product/price ID, and mode from the same test account together.",
] as const;
const billingConnect = [
  "Register the inbound URL shown in the code sample. Each app route passes the raw request to its adapter for signature verification before the shared billing BFF records the event.",
  "Checkout and portal requests use the authenticated `/api/billing/checkout` and `/api/billing/portal` routes. A browser return URL does not grant access; verified lifecycle events update the workspace entitlement ledger.",
  "A webhook is an HTTP message the provider sends to this app when a payment or subscription changes. Register the exact URL shown in the code sample, replacing `<your-app>` with a public HTTPS hostname. A provider cannot reach your computer's `localhost`; use its official local webhook tool or an HTTPS tunnel for local delivery tests.",
] as const;
const billingVerify = [
  "Exercise checkout, subscription changes, cancellation, duplicate event delivery, and workspace access in the provider's test or sandbox environment when available. Check the entitlement result after the webhook completes.",
  "Use the provider's test or sandbox dashboard and a signed-in workspace to start a test checkout. Confirm that the test transaction appears in the provider dashboard and that its webhook delivery succeeds. A signed-in checkout and entitlement check need PostgreSQL and migrations; `/ai` alone is only a local UI demo.",
  "If setup fails, check the missing-variable message against the exact names in the sample, then restart Web. For an unauthorized request, check that the provider selector and API key belong to the same account and mode. For a missing webhook, verify the route, public HTTPS hostname, and matching signing secret, then resend the event.",
  "For real payments, configure separate live products, IDs, credentials, and webhook endpoints. Store live secrets in your deployment host's server-only environment settings, use the production HTTPS hostname, and test the deployed flow before launch. Never deploy this local `.env.local` file.",
] as const;

const emailSetup = [
  "Set `EMAIL_PROVIDER` to this adapter, provide the listed credential fields, and choose `EMAIL_FROM` with a sender address accepted by your provider.",
  "Select this adapter with `EMAIL_PROVIDER` in the sample below. Create or verify a sender address or domain in the provider dashboard, then create the server credential shown in the code sample. Set `EMAIL_FROM` to a sender the provider has verified; the example uses `Display Name <you@example.com>` format.",
] as const;
const emailConnect = [
  "Transactional email means account or product messages such as sign-in codes and invitations. This integration sends transactional mail only; it is not a newsletter or outreach sender. The shared sender sends one recipient per request and requires text content even when HTML is also supplied.",
  "Keep `JOB_PROVIDER` selection separate: choosing an email transport does not move scheduled or queued work to the cloud runner.",
  "`EMAIL_PROVIDER=local` builds the message for local development but does not deliver it.",
] as const;
const emailVerify = [
  "Send one transactional message to a controlled inbox and inspect the returned delivery ID. `EMAIL_PROVIDER=local` exercises message construction only; it does not deliver mail.",
  "To check delivery, trigger an existing app flow that sends transactional mail, such as a sign-in code or workspace invitation, to an inbox you control. Check the provider's message activity and that inbox. Sign-in and invitations require PostgreSQL and migrations; a mail preview does not send a message.",
  "If a message is rejected, first confirm the key belongs to this provider and the sender is verified. Test or sandbox accounts may restrict recipient addresses. For production, complete the provider's approval steps and verify the production sending domain before sending to users.",
  "For production, use the provider's live credential and a verified sender. Add the values to your hosting platform's server-only environment settings; do not deploy this local `.env.local` file.",
] as const;

const aiSetup = [
  "Select this server-side adapter with `AI_PROVIDER` and set its matching credential. OpenAI-compatible also requires `OPENAI_COMPATIBLE_BASE_URL`; configuration validates the selected provider's required values.",
  "Select this server-side adapter with `AI_PROVIDER` and set its matching credential in the sample below. The default `AI_PROVIDER=fake` makes deterministic local demo responses and does not call a paid provider.",
  "For OpenAI-compatible APIs, also replace `OPENAI_COMPATIBLE_BASE_URL` with the API base URL from your vendor's official docs. The base URL and model API must be compatible; this is a connection setting, not the public website URL.",
] as const;
const aiConnect = [
  "Provider selection chooses the runtime adapter, while model IDs and prices remain in the database catalog. Add each model and its price history in the model catalog before routing user requests.",
  "`AI_MODEL_POLICY` can map fast, smart, and cheap aliases to ordered model IDs. `AGENT_FRAMEWORK` is configured separately, and workspace tools receive `workspaceId` from the server.",
  "An AI provider is the service receiving the model request. A model ID is the exact model name published by that service. `AI_PROVIDER` selects the service; the model catalog in your app's database stores each model ID and its price. This project does not prefill that catalog for you.",
] as const;
const aiVerify = [
  "Enable a catalog model and run one request through a product flow or the provider smoke workflow. Confirm the response and usage record, then check the disabled-alias and missing-key paths. `AI_PROVIDER=fake` is deterministic local plumbing and cannot serve agent runs.",
  "To test a real model, sign in to a workspace and run an AI request in the app; this needs a working PostgreSQL database and migrations. Check that a response appears and that the provider dashboard records usage. `AI_PROVIDER=fake` is for deterministic local UI flows and does not test a live provider.",
  "If the app reports a missing key, check the exact variable name and restart Web. If a request is unauthorized, verify the selected provider and key. If the model is unknown, verify the API model ID and that the model and pricing are in the catalog. A compatible endpoint must use the base URL and model API supported by its vendor.",
  "Production AI requests can incur provider charges. Use a separate production server key, verify model availability and pricing, and store the key in the hosting platform's server-only settings. Keep `AI_PROVIDER=fake` for local demos when you do not intend to make a paid API call.",
] as const;

const authSetup = [
  "Enable this provider's `AUTH_*_ENABLED` switch and add the matching client ID and client secret shown below. `packages/config` validates both values whenever the provider is enabled.",
  "Open the provider dashboard and register a Web application or OAuth app. Copy its client ID and client secret from the same app into the exact environment-variable names shown below. A client ID identifies this app; the client secret proves the Web server is the registered app.",
  "Set `AUTH_PROVIDER=better-auth` (the default) or `AUTH_PROVIDER=authjs`, set this provider's `AUTH_*_ENABLED=true` flag, and add both credential values. The app already handles the callback route; register the URL from the code sample in the provider dashboard instead of editing source code.",
] as const;
const authConnect = [
  "Sign-in is mounted under `/api/auth` and uses the engine selected by `AUTH_PROVIDER`. Better Auth is the default; Auth.js is available as the alternate engine.",
  "Register the local callback path shown in the code sample and the matching deployed path under the origin that serves the auth route. Use the callback ID for the selected engine.",
  "OAuth lets this app ask an identity provider to sign a person in. A callback URL is the exact Web route where the provider returns the browser after sign-in. Register the code sample's URL exactly, including `http://localhost:3000` for local development; when deployed, add the matching `https://` URL for your production hostname.",
] as const;
const authVerify = [
  "Test first-time and returning sign-in, sign-out, disabled-provider behavior, and a protected workspace action. With Auth.js, a new social identity needs a verified email; a previously linked provider identity remains authoritative.",
  "Start with your own account on the provider's test-user or consent screen list. With PostgreSQL running and migrated, open `http://localhost:3000/auth`, choose this provider, approve the request, and confirm that the browser returns to your app with an active session.",
  "If the provider reports a redirect mismatch, compare the registered URL to the sample character by character, including localhost versus production. If it reports an invalid client, check the enabled flag and that the ID and secret belong to the same provider app; then restart Web.",
  "For production sign-in, register the exact HTTPS callback for the deployed host, use that host's server-side credentials, and complete any provider consent-screen or app-review requirements before inviting users.",
] as const;

const providerDefinitions: readonly ProviderDefinition[] = [
  {
    slug: "providers/stripe",
    group: "Billing & entitlements",
    title: "Stripe",
    description: "Connect Stripe checkout and signed events to workspace entitlements.",
    providerLinks: [
      providerDashboardLink("https://dashboard.stripe.com/register"),
      providerDocsLink("https://docs.stripe.com/testing"),
    ],
    setup: billingSetup,
    setupCode:
      "BILLING_PROVIDER=stripe\nSTRIPE_SECRET_KEY=<server-secret>\nSTRIPE_WEBHOOK_SECRET=<signing-secret>\nSTRIPE_PRICE_ID=<default-price-id>",
    connect: billingConnect,
    connectCode:
      "# Register this URL in Stripe's webhook settings:\nhttps://<your-app>/api/billing/webhook",
    verify: billingVerify,
    relatedLinks: billingLinks,
  },
  {
    slug: "providers/lemonsqueezy",
    group: "Billing & entitlements",
    title: "Lemon Squeezy",
    description: "Connect Lemon Squeezy variants and signed events to workspace entitlements.",
    providerLinks: [
      providerDashboardLink("https://app.lemonsqueezy.com/"),
      providerDocsLink("https://docs.lemonsqueezy.com/help/getting-started/test-mode"),
    ],
    setup: billingSetup,
    setupCode:
      "BILLING_PROVIDER=lemonsqueezy\nLEMONSQUEEZY_API_KEY=<server-secret>\nLEMONSQUEEZY_STORE_ID=<store-id>\nLEMONSQUEEZY_VARIANT_ID=<default-variant-id>\nLEMONSQUEEZY_WEBHOOK_SECRET=<signing-secret>",
    connect: billingConnect,
    connectCode:
      "# Register this URL in Lemon Squeezy's webhook settings:\nhttps://<your-app>/api/billing/webhook/lemonsqueezy",
    verify: billingVerify,
    relatedLinks: billingLinks,
  },
  {
    slug: "providers/creem",
    group: "Billing & entitlements",
    title: "Creem",
    description: "Connect Creem products and signed events to workspace entitlements.",
    providerLinks: [
      providerDashboardLink("https://www.creem.io/dashboard"),
      providerDocsLink("https://docs.creem.io/"),
    ],
    setup: billingSetup,
    setupCode:
      "BILLING_PROVIDER=creem\nCREEM_API_KEY=<server-secret>\nCREEM_PRODUCT_ID=<default-product-id>\nCREEM_WEBHOOK_SECRET=<signing-secret>\nCREEM_TEST_MODE=true",
    connect: billingConnect,
    connectCode:
      "# Register this URL in Creem's webhook settings:\nhttps://<your-app>/api/billing/webhook/creem",
    verify: billingVerify,
    relatedLinks: billingLinks,
  },
  {
    slug: "providers/polar",
    group: "Billing & entitlements",
    title: "Polar",
    description: "Connect Polar products and signed events to workspace entitlements.",
    providerLinks: [
      providerDashboardLink("https://polar.sh/dashboard"),
      providerDocsLink("https://docs.polar.sh/onboarding"),
    ],
    setup: billingSetup,
    setupCode:
      "BILLING_PROVIDER=polar\nPOLAR_ACCESS_TOKEN=<server-secret>\nPOLAR_PRODUCT_ID=<default-product-id>\nPOLAR_WEBHOOK_SECRET=<signing-secret>\nPOLAR_SERVER=sandbox",
    connect: billingConnect,
    connectCode:
      "# Register this URL in Polar's webhook settings:\nhttps://<your-app>/api/billing/webhook/polar",
    verify: billingVerify,
    relatedLinks: billingLinks,
  },
  {
    slug: "providers/whop",
    group: "Billing & entitlements",
    title: "Whop",
    description: "Connect Whop plans and signed events to workspace entitlements.",
    providerLinks: [
      providerDashboardLink("https://whop.com/dashboard/"),
      providerDocsLink("https://docs.whop.com/api-reference/plans/retrieve-plan"),
    ],
    setup: billingSetup,
    setupCode:
      "BILLING_PROVIDER=whop\nWHOP_API_KEY=<server-secret>\nWHOP_PLAN_ID=<default-plan-id>\nWHOP_WEBHOOK_SECRET=<signing-secret>",
    connect: billingConnect,
    connectCode:
      "# Register this URL in Whop's webhook settings:\nhttps://<your-app>/api/billing/webhook/whop",
    verify: billingVerify,
    relatedLinks: billingLinks,
  },
  {
    slug: "providers/paddle",
    group: "Billing & entitlements",
    title: "Paddle",
    description: "Connect Paddle prices and signed events to workspace entitlements.",
    providerLinks: [
      providerDashboardLink("https://sandbox-vendors.paddle.com/"),
      providerDocsLink("https://developer.paddle.com/get-started/quickstart/"),
    ],
    setup: billingSetup,
    setupCode:
      "BILLING_PROVIDER=paddle\nPADDLE_API_KEY=<server-secret>\nPADDLE_PRICE_ID=<default-price-id>\nPADDLE_WEBHOOK_SECRET=<signing-secret>\nPADDLE_ENVIRONMENT=sandbox",
    connect: billingConnect,
    connectCode:
      "# Register this URL in Paddle's webhook settings:\nhttps://<your-app>/api/billing/webhook/paddle",
    verify: billingVerify,
    relatedLinks: billingLinks,
  },
  {
    slug: "providers/dodo",
    group: "Billing & entitlements",
    title: "Dodo Payments",
    description: "Connect Dodo Payments products and signed events to workspace entitlements.",
    providerLinks: [
      providerDashboardLink("https://app.dodopayments.com/"),
      providerDocsLink("https://docs.dodopayments.com/guides/login"),
    ],
    setup: billingSetup,
    setupCode:
      "BILLING_PROVIDER=dodo\nDODO_PAYMENTS_API_KEY=<server-secret>\nDODO_PRODUCT_ID=<default-product-id>\nDODO_PAYMENTS_WEBHOOK_KEY=<signing-secret>\nDODO_PAYMENTS_ENVIRONMENT=test_mode",
    connect: billingConnect,
    connectCode:
      "# Register this URL in Dodo Payments' webhook settings:\nhttps://<your-app>/api/billing/webhook/dodo",
    verify: billingVerify,
    relatedLinks: billingLinks,
  },
  {
    slug: "providers/paypal",
    group: "Billing & entitlements",
    title: "PayPal",
    description: "Connect PayPal subscription plans and verified events to workspace entitlements.",
    providerLinks: [
      providerDashboardLink("https://developer.paypal.com/dashboard/"),
      providerDocsLink("https://developer.paypal.com/platforms/subscriptions/test-subscriptions/"),
    ],
    setup: billingSetup,
    setupCode:
      "BILLING_PROVIDER=paypal\nPAYPAL_CLIENT_ID=<client-id>\nPAYPAL_CLIENT_SECRET=<server-secret>\nPAYPAL_PLAN_ID=<default-plan-id>\nPAYPAL_WEBHOOK_ID=<webhook-id>\nPAYPAL_ENVIRONMENT=sandbox",
    connect: billingConnect,
    connectCode:
      "# Register this URL in PayPal's webhook settings:\nhttps://<your-app>/api/billing/webhook/paypal",
    verify: billingVerify,
    relatedLinks: billingLinks,
  },
  {
    slug: "providers/resend",
    group: "Jobs & email",
    title: "Resend",
    description: "Send transactional messages through the Resend adapter.",
    providerLinks: [
      providerDashboardLink("https://resend.com/api-keys"),
      providerDocsLink("https://resend.com/docs/dashboard/api-keys/introduction"),
    ],
    setup: emailSetup,
    setupCode:
      "EMAIL_PROVIDER=resend\nEMAIL_FROM=Your App <hello@example.test>\nRESEND_API_KEY=<server-secret>",
    connect: emailConnect,
    verify: emailVerify,
    relatedLinks: emailLinks,
  },
  {
    slug: "providers/ses",
    group: "Jobs & email",
    title: "Amazon SES",
    description: "Send transactional messages through the Amazon SES adapter.",
    providerLinks: [
      providerDashboardLink("https://console.aws.amazon.com/ses/home"),
      providerDocsLink("https://docs.aws.amazon.com/ses/latest/dg/creating-identities.html"),
    ],
    setup: emailSetup,
    setupNote:
      "Use the region where you verified the sender identity as `AWS_REGION`. The SES SDK accepts an IAM role or local AWS profile when keys are blank, or a complete AWS access-key pair with optional `AWS_SESSION_TOKEN` for temporary credentials. Grant `ses:SendEmail` on the verified identity. SDK keys are different from SMTP credentials. SES sandbox recipients must be verified; request production access before sending to ordinary customers. See `docs/aws-ses.md` for SDK setup, classic IAM SMTP credentials, and Mail Manager pricing.",
    setupCode:
      "EMAIL_PROVIDER=ses\nEMAIL_FROM=Your App <hello@example.test>\nAWS_REGION=us-east-1\nAWS_ACCESS_KEY_ID=<server-access-key>\nAWS_SECRET_ACCESS_KEY=<server-secret-key>",
    connect: emailConnect,
    verify: emailVerify,
    relatedLinks: emailLinks,
  },
  {
    slug: "providers/postmark",
    group: "Jobs & email",
    title: "Postmark",
    description: "Send transactional messages through the Postmark adapter.",
    providerLinks: [
      providerDashboardLink("https://account.postmarkapp.com/"),
      providerDocsLink("https://postmarkapp.com/developer/get-started"),
    ],
    setup: emailSetup,
    setupCode:
      "EMAIL_PROVIDER=postmark\nEMAIL_FROM=Your App <hello@example.test>\nPOSTMARK_SERVER_TOKEN=<server-secret>",
    connect: emailConnect,
    verify: emailVerify,
    relatedLinks: emailLinks,
  },
  {
    slug: "providers/sendgrid",
    group: "Jobs & email",
    title: "SendGrid",
    description: "Send transactional messages through the SendGrid adapter.",
    providerLinks: [
      providerDashboardLink("https://app.sendgrid.com/"),
      providerDocsLink(
        "https://www.twilio.com/docs/sendgrid/onboarding/email-api/build-and-test-your-application",
      ),
    ],
    setup: emailSetup,
    setupNote:
      "Create a SendGrid API key that has permission to send mail, then complete sender authentication or verify the individual sender address used by `EMAIL_FROM`.",
    setupCode:
      "EMAIL_PROVIDER=sendgrid\nEMAIL_FROM=Your App <hello@example.test>\nSENDGRID_API_KEY=<server-secret>",
    connect: emailConnect,
    verify: emailVerify,
    relatedLinks: emailLinks,
  },
  {
    slug: "providers/mailgun",
    group: "Jobs & email",
    title: "Mailgun",
    description: "Send transactional messages through the Mailgun adapter.",
    providerLinks: [
      providerDashboardLink("https://app.mailgun.com/"),
      providerDocsLink("https://documentation.mailgun.com/docs/mailgun/quickstart"),
    ],
    setup: emailSetup,
    setupNote:
      "Use the Mailgun sending domain shown in its dashboard for `MAILGUN_DOMAIN`, and select `MAILGUN_REGION=us` or `eu` to match that domain's region. The app accepts a private API key; a domain sending key is a narrower option when your Mailgun account supports it.",
    setupCode:
      "EMAIL_PROVIDER=mailgun\nEMAIL_FROM=Your App <hello@example.test>\nMAILGUN_API_KEY=<server-secret>\nMAILGUN_DOMAIN=<sending-domain>\nMAILGUN_REGION=us # us (default) or eu",
    connect: emailConnect,
    verify: emailVerify,
    relatedLinks: emailLinks,
  },
  {
    slug: "providers/smtp",
    group: "Jobs & email",
    title: "SMTP",
    description: "Send transactional messages through the configured SMTP server.",
    providerLinks: [smtpReferenceLink],
    setup: emailSetup,
    setupNote:
      "SMTP is a mail-delivery standard, not one company, so there is no shared dashboard URL. Choose an email host that offers authenticated SMTP, then get its host, port, username, and password from that host's official dashboard. Use port 465 with `SMTP_SECURE=true` for implicit TLS, or port 587 with `SMTP_SECURE=false` for STARTTLS. If you enter either `SMTP_USER` or `SMTP_PASSWORD`, enter both.",
    setupCode:
      "EMAIL_PROVIDER=smtp\nEMAIL_FROM=Your App <hello@example.test>\nSMTP_HOST=<smtp-host>\nSMTP_PORT=587\nSMTP_SECURE=false\n# Set both when SMTP authentication is required:\nSMTP_USER=<username>\nSMTP_PASSWORD=<server-secret>",
    connect: emailConnect,
    verify: emailVerify,
    relatedLinks: emailLinks,
  },
  {
    slug: "providers/brevo",
    group: "Jobs & email",
    title: "Brevo",
    description: "Send transactional messages through the Brevo adapter.",
    providerLinks: [
      providerDashboardLink("https://app.brevo.com/"),
      providerDocsLink("https://developers.brevo.com/docs/api-key-authentication"),
    ],
    setup: emailSetup,
    setupNote:
      "Create a Brevo API key from the SMTP & API settings page and use that API key for `BREVO_API_KEY`; the SMTP key is a different credential. Verify the sender address or domain used by `EMAIL_FROM`.",
    setupCode:
      "EMAIL_PROVIDER=brevo\nEMAIL_FROM=Your App <hello@example.test>\nBREVO_API_KEY=<server-secret>",
    connect: emailConnect,
    verify: emailVerify,
    relatedLinks: emailLinks,
  },
  {
    slug: "providers/openai",
    group: "AI & agents",
    title: "OpenAI",
    description: "Route catalog model requests through the OpenAI adapter.",
    providerLinks: [
      providerDashboardLink("https://platform.openai.com/api-keys"),
      providerDocsLink("https://platform.openai.com/docs/quickstart"),
    ],
    setup: aiSetup,
    setupCode: "AI_PROVIDER=openai\nOPENAI_API_KEY=<server-secret>",
    connect: aiConnect,
    verify: aiVerify,
    relatedLinks: aiLinks,
  },
  {
    slug: "providers/anthropic",
    group: "AI & agents",
    title: "Anthropic",
    description: "Route catalog model requests through the Anthropic adapter.",
    providerLinks: [
      providerDashboardLink("https://console.anthropic.com/settings/keys"),
      providerDocsLink("https://platform.claude.com/docs/en/get-started"),
    ],
    setup: aiSetup,
    setupCode: "AI_PROVIDER=anthropic\nANTHROPIC_API_KEY=<server-secret>",
    connect: aiConnect,
    verify: aiVerify,
    relatedLinks: aiLinks,
  },
  {
    slug: "providers/openai-compatible",
    group: "AI & agents",
    title: "OpenAI-compatible API",
    description: "Connect a compatible endpoint with its base URL and server key.",
    providerLinks: [compatibleApiLink],
    setup: aiSetup,
    setupNote:
      "There is no single dashboard for an OpenAI-compatible API. Use the account dashboard and API guide from the service you choose to create its key and copy its exact base URL. The compatibility guide explains the API details this setting needs.",
    setupCode:
      "AI_PROVIDER=openai-compatible\nOPENAI_COMPATIBLE_API_KEY=<server-secret>\nOPENAI_COMPATIBLE_BASE_URL=https://api.example.test/v1",
    connect: aiConnect,
    verify: aiVerify,
    relatedLinks: aiLinks,
  },
  {
    slug: "providers/google-oauth",
    group: "Authentication",
    title: "Google OAuth",
    description: "Enable Google sign-in with the credentials read by the auth runtime.",
    providerLinks: [
      providerDashboardLink("https://console.cloud.google.com/apis/credentials"),
      providerDocsLink("https://developers.google.com/identity/protocols/oauth2/web-server"),
    ],
    setup: authSetup,
    setupNote:
      "Create a Web application OAuth client. While its consent screen is in testing, add your own Google account as a test user. Use the client ID and secret from the same Google Cloud project.",
    setupCode:
      "AUTH_PROVIDER=better-auth # or authjs\nAPP_URL=http://localhost:3000\nAUTH_GOOGLE_ENABLED=true\nGOOGLE_CLIENT_ID=<client-id>\nGOOGLE_CLIENT_SECRET=<server-secret>",
    connect: authConnect,
    connectCode:
      "# Better Auth callback URL:\nhttp://localhost:3000/api/auth/callback/google\n# Auth.js callback URL:\nhttp://localhost:3000/api/auth/callback/google",
    verify: authVerify,
    relatedLinks: authLinks,
  },
  {
    slug: "providers/apple-oauth",
    group: "Authentication",
    title: "Apple OAuth",
    description: "Enable Apple sign-in with the credentials read by the auth runtime.",
    providerLinks: [
      providerDashboardLink(
        "https://developer.apple.com/account/resources/identifiers/list/serviceId",
      ),
      providerDocsLink(
        "https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web",
      ),
      providerDocsLink(
        "https://developer.apple.com/documentation/signinwithapplerestapi/creating-a-client-secret",
      ),
    ],
    setup: authSetup,
    setupNote:
      "Apple web sign-in needs an enabled primary App ID and a Services ID for the website. Use the Services ID as `APPLE_CLIENT_ID`. Apple does not provide a plain client-secret value: create a signed client-secret JWT from your Team ID, Key ID, and private key, then put that JWT in `APPLE_CLIENT_SECRET`. The downloaded `.p8` file is private signing material, not the value to paste into this setting.",
    setupCode:
      "AUTH_PROVIDER=better-auth # or authjs\nAPP_URL=http://localhost:3000\nAUTH_APPLE_ENABLED=true\nAPPLE_CLIENT_ID=<client-id>\nAPPLE_CLIENT_SECRET=<server-secret>",
    connect: authConnect,
    connectCode:
      "# Better Auth callback URL:\nhttp://localhost:3000/api/auth/callback/apple\n# Auth.js callback URL:\nhttp://localhost:3000/api/auth/callback/apple",
    verify: authVerify,
    relatedLinks: authLinks,
  },
  {
    slug: "providers/github-oauth",
    group: "Authentication",
    title: "GitHub OAuth",
    description: "Enable GitHub sign-in with the credentials read by the auth runtime.",
    providerLinks: [
      providerDashboardLink("https://github.com/settings/developers"),
      providerDocsLink(
        "https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app",
      ),
    ],
    setup: authSetup,
    setupNote:
      "Create a GitHub OAuth App and use its Authorization callback URL field for the callback in the code sample. This guide uses an OAuth App for sign-in; a GitHub App is a separate integration type.",
    setupCode:
      "AUTH_PROVIDER=better-auth # or authjs\nAPP_URL=http://localhost:3000\nAUTH_GITHUB_ENABLED=true\nGITHUB_CLIENT_ID=<client-id>\nGITHUB_CLIENT_SECRET=<server-secret>",
    connect: authConnect,
    connectCode:
      "# Better Auth callback URL:\nhttp://localhost:3000/api/auth/callback/github\n# Auth.js callback URL:\nhttp://localhost:3000/api/auth/callback/github",
    verify: authVerify,
    relatedLinks: authLinks,
  },
  {
    slug: "providers/twitter-oauth",
    group: "Authentication",
    title: "Twitter OAuth",
    description: "Enable Twitter sign-in with the credentials read by the auth runtime.",
    providerLinks: [
      providerDashboardLink("https://developer.x.com/en/portal/dashboard"),
      providerDocsLink("https://docs.x.com/fundamentals/authentication/oauth-2-0/overview"),
    ],
    setup: authSetup,
    setupNote:
      "In the X developer app, enable OAuth 2.0 user authentication and configure the callback URL shown below. Use the OAuth 2.0 client ID and client secret for this app; an app-only bearer token is not a substitute.",
    setupCode:
      "AUTH_PROVIDER=better-auth # or authjs\nAPP_URL=http://localhost:3000\nAUTH_TWITTER_ENABLED=true\nTWITTER_CLIENT_ID=<client-id>\nTWITTER_CLIENT_SECRET=<server-secret>",
    connect: authConnect,
    connectCode:
      "# Better Auth callback URL:\nhttp://localhost:3000/api/auth/callback/twitter\n# Auth.js callback URL:\nhttp://localhost:3000/api/auth/callback/twitter",
    verify: authVerify,
    relatedLinks: authLinks,
  },
  {
    slug: "providers/microsoft-oauth",
    group: "Authentication",
    title: "Microsoft OAuth",
    description: "Enable Microsoft sign-in with the credentials read by the auth runtime.",
    providerLinks: [
      providerDashboardLink(
        "https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
      ),
      providerDocsLink(
        "https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app",
      ),
    ],
    setup: authSetup,
    setupNote:
      "Create an app registration in Microsoft Entra and add the callback under its Web platform settings. Choose the supported account types that match the people who will sign in. The Microsoft sample shows separate callback IDs for Better Auth and Auth.js; use the one that matches `AUTH_PROVIDER`.",
    setupCode:
      "AUTH_PROVIDER=better-auth # or authjs\nAPP_URL=http://localhost:3000\nAUTH_MICROSOFT_ENABLED=true\nMICROSOFT_CLIENT_ID=<client-id>\nMICROSOFT_CLIENT_SECRET=<server-secret>",
    connect: authConnect,
    connectCode:
      "# Better Auth callback URL:\nhttp://localhost:3000/api/auth/callback/microsoft\n# Auth.js callback URL:\nhttp://localhost:3000/api/auth/callback/microsoft-entra-id",
    verify: authVerify,
    relatedLinks: authLinks,
  },
];

function sectionsFor(provider: ProviderDefinition): Guide["sections"] {
  return [
    {
      id: "setup",
      title: "Set up the provider",
      paragraphs: [
        ...commonWebSetup,
        ...provider.setup,
        ...(provider.setupNote === undefined ? [] : [provider.setupNote]),
      ],
      code: provider.setupCode,
      links: [environmentLink, databaseLink, ...provider.providerLinks],
    },
    {
      id: "restart",
      title: "Restart Web",
      paragraphs: [
        "After changing a setting, save `apps/web/.env.local`, stop the running server with `Ctrl+C`, and run this command from the repository root. The server reads the saved values when it starts.",
      ],
      code: "corepack pnpm --filter @supastack/web dev",
    },
    {
      id: "connect",
      title: "Connect the application flow",
      paragraphs: provider.connect,
      ...(provider.connectCode === undefined ? {} : { code: provider.connectCode }),
    },
    {
      id: "verify",
      title: "Verify the integration",
      paragraphs: provider.verify,
      links: provider.relatedLinks,
    },
  ];
}

export const providerGuides: readonly Guide[] = providerDefinitions.map((provider) => ({
  slug: provider.slug,
  tab: "modules",
  group: provider.group,
  title: provider.title,
  description: provider.description,
  sections: sectionsFor(provider),
}));
