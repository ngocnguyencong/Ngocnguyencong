# apps/web/src/server-provider-composition.ts

> Last updated: 2026-09-25 | Protection: STANDARD

## Purpose

Composes server providers from `ServerConfig.providers.*`: `AiProvider`
(fake, openai, anthropic, openai-compatible, openrouter), billing adapters
(local, stripe, lemonsqueezy, creem, polar, whop, paddle, dodo, paypal),
email senders, jobs, storage, captcha, custom domains. Default client
factories call the respective SDK/HTTP clients; tests inject offline
factories.

## Important Notes / NEVER Change

- OpenRouter default factory sends attribution headers:
  `OPENROUTER_APP_NAME` → `X-Title`, `OPENROUTER_SITE_URL` → `HTTP-Referer`
  (spread-gated for `exactOptionalPropertyTypes`).
- `createConfiguredPlatformKeyResolver` accepts every keyed config kind and
  returns the configured platform key for `SdkAiProvider` subclasses.
- Every AI SDK `generateText` path forwards the provider request signal as
  `abortSignal`, preserving cancellation through native SDK transport.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-25 | Paddle (`createPaddleClient` — fetch, `Paddle-Version: 1`), Dodo (`createDodoClient` — fetch), PayPal (`createPaypalClient` — OAuth token + `verify-webhook-signature` server call) factories/branches/config types (phase B5) | Devin |
| 2026-09-22 | Polar (`createPolarClient` → `@polar-sh/sdk`) + Whop (`createWhopClient` → `@whop/sdk` + `unwrapWebhook`) factories/branches/resolver; `createEmailSdkClient` factory for the 5 email-sdk transports | Devin |
| 2026-09-23 | Added `OpenRouterConfig` + `createOpenRouterClient` factory/branch/resolver | Devin |
| 2026-10-01 | Forward provider cancellation signal to AI SDK generation calls | Codex |

## 2026-10-04 — AWS SES

SESv2Client receives a complete explicit key pair plus optional sessionToken, or no credentials option so the Node SDK can resolve and refresh role/profile credentials. The existing transactional sender and workspace boundaries remain shared.
