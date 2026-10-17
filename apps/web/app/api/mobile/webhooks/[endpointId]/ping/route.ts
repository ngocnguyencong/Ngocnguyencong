import { NextResponse } from "next/server";

import { pingWebhookEndpointAction } from "../../../../../../src/webhooks-actions";
import { requireWorkspaceManager } from "../../../../../../src/workspace-access";

export const runtime = "nodejs";

/** Sends a `ping` test event through the endpoint's delivery path. */
export async function POST(
  _request: Request,
  context: { params: Promise<{ endpointId: string }> },
) {
  const manager = await requireWorkspaceManager();
  if ("error" in manager) {
    return NextResponse.json(
      { error: manager.error },
      { status: manager.error === "Sign in required." ? 401 : 403 },
    );
  }
  const { endpointId } = await context.params;
  const formData = new FormData();
  formData.set("endpointId", endpointId);
  await pingWebhookEndpointAction(formData);
  return NextResponse.json({ ok: true });
}
