import { PUBLIC_CORS, err, ok } from "../../../../../src/supadata/api";
import { resolveRequestSite } from "../../../../../src/supadata/auth";
import { normalizeProviderPayload, recordPayment } from "../../../../../src/supadata/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDERS = new Set([
  "stripe",
  "lemonsqueezy",
  "polar",
  "paddle",
  "shopify",
  "woocommerce",
  "dodo",
]);

/**
 * POST /api/v1/webhooks/{provider}?site_id=sdid_…&key=sd_…
 * Provider payloads are normalized to a payment + attributed to the visitor
 * captured at checkout (via `sd_visitor_id` metadata / client_reference_id).
 */
export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  if (!PROVIDERS.has(provider)) return err("Unknown provider", 404, { headers: PUBLIC_CORS });
  const url = new URL(request.url);
  const site = await resolveRequestSite(url);
  if (!site) return err("Unauthorized or unknown site", 401, { headers: PUBLIC_CORS });
  const payload = (await request.json().catch(() => null)) as unknown;
  if (!payload) return err("Invalid JSON", 400, { headers: PUBLIC_CORS });
  const normalized = normalizeProviderPayload(provider, payload);
  if (!normalized) return ok({ ignored: true }, { headers: PUBLIC_CORS });
  const result = await recordPayment(site.id, {
    amountCents: normalized.amountCents,
    currency: normalized.currency,
    email: normalized.email,
    visitorRef: normalized.visitorRef,
    userId: normalized.userId,
    externalId: normalized.externalId,
    provider,
    kind: normalized.kind,
    interval: normalized.interval,
    productName: normalized.productName,
  });
  if (!result) return err("Failed to record payment", 500, { headers: PUBLIC_CORS });
  return ok(result, { status: 201, headers: PUBLIC_CORS });
}
