import { NextResponse } from "next/server";

import { removeWorkspaceDomain } from "../../../../../src/custom-domains/domain-actions";

export const runtime = "nodejs";

/** Removes a custom domain (owner/admin only). */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ domainId: string }> },
) {
  const { domainId } = await context.params;
  const result = await removeWorkspaceDomain(domainId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ ok: true });
}
