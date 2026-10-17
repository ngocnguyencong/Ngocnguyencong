/**
 * Standard Webhooks (https://www.standardwebhooks.com/) signature transport.
 *
 * The framework-neutral `SignedStripeWebhookRequest` contract carries a single
 * `signature` string. Standard Webhooks providers (Polar, Whop) sign with three
 * headers — `webhook-id`, `webhook-timestamp`, `webhook-signature` — so routes
 * pack them into a JSON string with {@link encodeStandardWebhookSignature} and
 * adapters recover them with {@link decodeStandardWebhookSignature}. The event
 * id lives in `webhook-id`, not the payload, so it must travel with the
 * signature.
 */
export const STANDARD_WEBHOOK_SIGNATURE_HEADERS = [
  "webhook-id",
  "webhook-timestamp",
  "webhook-signature",
] as const;

export type StandardWebhookHeaders = Readonly<Record<string, string>>;

/** Pack the three Standard Webhooks headers into the single `signature` field. */
export function encodeStandardWebhookSignature(headers: StandardWebhookHeaders): string {
  return JSON.stringify(
    Object.fromEntries(
      STANDARD_WEBHOOK_SIGNATURE_HEADERS.map((name) => [name, headers[name] ?? ""]),
    ),
  );
}

/** Recover the headers packed by {@link encodeStandardWebhookSignature}. */
export function decodeStandardWebhookSignature(signature: string): StandardWebhookHeaders | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(signature);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const headers: Record<string, string> = {};
  for (const name of STANDARD_WEBHOOK_SIGNATURE_HEADERS) {
    const value = (parsed as Record<string, unknown>)[name];
    if (typeof value !== "string" || value.trim() === "") {
      return null;
    }
    headers[name] = value;
  }

  return headers;
}
