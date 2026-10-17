import { PUBLIC_CORS, err, ok } from "../../../../src/supadata/api";
import { resolveRequestSite } from "../../../../src/supadata/auth";
import { parsePaymentInput, recordPayment } from "../../../../src/supadata/payments";
import { payments, resolveRange } from "../../../../src/supadata/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const site = await resolveRequestSite(url);
  if (!site) return err("Unauthorized or unknown site", 401, { headers: PUBLIC_CORS });
  const range = resolveRange(
    url.searchParams.get("period"),
    url.searchParams.get("from"),
    url.searchParams.get("to"),
  );
  return ok(await payments(site.id, range), { headers: PUBLIC_CORS });
}

/** POST /api/v1/payments — record a payment/refund for revenue attribution. */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const site = await resolveRequestSite(url);
  if (!site) return err("Unauthorized or unknown site", 401, { headers: PUBLIC_CORS });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return err("Invalid JSON", 400, { headers: PUBLIC_CORS });
  }
  const input = parsePaymentInput({ ...(raw as object), site_id: site.id });
  if (!input) return err("Invalid payment payload", 400, { headers: PUBLIC_CORS });

  const interval = input.subscription
    ? input.subscription.interval_count >= 12
      ? "year"
      : input.subscription.interval
    : "once";
  const result = await recordPayment(site.id, {
    amountCents: Math.round(input.amount * 100),
    currency: input.currency,
    email: input.email ?? null,
    visitorRef: input.visitor_id ?? null,
    userId: input.user_id ?? null,
    externalId: input.transaction_id ?? null,
    provider: "api",
    kind: input.refunded ? "refund" : "payment",
    interval,
    productName: input.subscription?.plan_name ?? null,
  });
  if (!result) return err("Failed to record payment", 500, { headers: PUBLIC_CORS });
  return ok(result, { status: 201, headers: PUBLIC_CORS });
}
