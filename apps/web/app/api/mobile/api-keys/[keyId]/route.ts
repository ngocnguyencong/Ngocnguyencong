import { NextResponse } from "next/server";

import { revokeApiKeyAction } from "../../../../../src/api-keys-actions";
import { requireWorkspaceManager } from "../../../../../src/workspace-access";

export const runtime = "nodejs";

/** Revokes an API key (owner/admin only). */
export async function DELETE(_request: Request, context: { params: Promise<{ keyId: string }> }) {
  const manager = await requireWorkspaceManager();
  if ("error" in manager) {
    return NextResponse.json(
      { error: manager.error },
      { status: manager.error === "Sign in required." ? 401 : 403 },
    );
  }
  const { keyId } = await context.params;
  const formData = new FormData();
  formData.set("keyId", keyId);
  await revokeApiKeyAction(formData);
  return NextResponse.json({ ok: true });
}
