import { NextResponse } from "next/server";

import {
  createWebhookEndpointAction,
  listWebhookEndpoints,
} from "../../../../src/webhooks-actions";

export const runtime = "nodejs";

/** Lists webhook endpoints for the caller's active workspace. */
export async function GET() {
  const result = await listWebhookEndpoints();
  if (result.error !== undefined) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }
  return NextResponse.json({ endpoints: result.endpoints, manageable: result.manageable });
}

/** Creates a webhook endpoint; the signing secret is returned exactly once. */
export async function POST(request: Request) {
  let body: { events?: unknown; url?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const result = await createWebhookEndpointAction({
    events: Array.isArray(body.events)
      ? body.events.filter((event): event is string => typeof event === "string")
      : [],
    url: typeof body.url === "string" ? body.url : "",
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json(
    { endpointId: result.endpointId, secret: result.secret },
    { status: 201 },
  );
}
