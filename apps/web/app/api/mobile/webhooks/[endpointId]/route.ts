import { NextResponse } from "next/server";

import { deleteWebhookEndpointAction } from "../../../../../src/webhooks-actions";
import { requireWorkspaceManager } from "../../../../../src/workspace-access";

export const runtime = "nodejs";

/** Deletes a webhook endpoint (owner/admin only). */
export async function DELETE(
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
  await deleteWebhookEndpointAction(formData);
  return NextResponse.json({ ok: true });
}
