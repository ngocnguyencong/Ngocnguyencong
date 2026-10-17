import { NextResponse } from "next/server";

import { listWebhookDeliveries } from "../../../../../../src/webhooks-actions";

export const runtime = "nodejs";

/** Recent delivery attempts for a webhook endpoint (owner/admin only). */
export async function GET(_request: Request, context: { params: Promise<{ endpointId: string }> }) {
  const { endpointId } = await context.params;
  const result = await listWebhookDeliveries(endpointId);
  return NextResponse.json({ deliveries: result.deliveries });
}
