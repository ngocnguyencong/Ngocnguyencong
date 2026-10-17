# Real-provider acceptance smoke

This path is separate from PR CI and `pnpm verify:local`. It makes real, potentially billable
network calls and therefore fails closed until `RUN_REAL_PROVIDER_SMOKE=true` is present.

## Prepared prerequisites

- A current OpenAI model ID plus a provider-side project budget and alert.
- A dedicated Resend test domain/recipient, or SES credentials and verified identities. Set
  `REAL_SMOKE_EMAIL_ALLOWED_DOMAIN` to that exact test domain; the recipient must be one valid
  address in it.
- A recurring Stripe sandbox Price, a webhook endpoint secret, and a restricted API key with only
  the Checkout and Customer Portal permissions needed by this application.
- An isolated Trigger.dev project and a deployed task whose identifier begins with `smoke.` if
  `JOB_PROVIDER=trigger` is selected. Set both `TRIGGER_PROJECT_REF` and the separately named
  `REAL_SMOKE_TRIGGER_PROJECT_REF` to that exact non-production project reference.
- An application HTTPS origin and a migrated disposable/staging Postgres database for the signed
  webhook replay.

Keep credentials in the hosting platform or CI secret store. Do not put them in `.env.smoke.example`,
commit them, paste them into documentation, or print them in logs. Use separate limits and identities
for smoke testing.

## Run the provider connections

Set normal server configuration for `AI_PROVIDER=openai`, `EMAIL_PROVIDER=resend` or `ses`, and
`BILLING_PROVIDER=stripe`. Fill the non-secret operator values listed in `.env.smoke.example`, then
explicitly authorize the run:

```bash
pnpm smoke:providers
```

The command makes one small AI request (maximum 16 output tokens, no SDK retries, 15-second timeout),
sends one transactional message, creates one unconsumed subscription Checkout Session in the Stripe
sandbox, and—when selected—enqueues one already-deployed dedicated Trigger.dev task. It does not
visit Checkout, create a subscription, or grant an entitlement.

## Verify signed lifecycle fulfillment

Deploy the Web app with the same Stripe sandbox configuration and run migrations. Configure Stripe
to send these events to `/api/billing/webhook`:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Complete one sandbox Checkout from `/billing`. Confirm the signed event creates the workspace-owned
customer, subscription, and entitlement records; replay the same event and confirm it remains a
duplicate without changing access twice. Then open Customer Portal from `/billing` and cancel the
sandbox subscription, confirming the entitlement becomes inactive. A database failure must return
HTTP 500 so Stripe retries; an invalid signature must return HTTP 400.

Do not enable `automatic_tax` merely for this smoke. Before enabling Stripe Tax in a real product,
configure the required tax registrations—Stripe does not collect tax without active registrations.

## Timing evidence

Record start/end time, model ID/version, email provider, Stripe sandbox event IDs, and pass/fail only.
Never record secrets or raw payloads. The acceptance target is under 30 minutes when accounts, keys,
DNS, a recurring Price, and the Trigger task are already prepared.
