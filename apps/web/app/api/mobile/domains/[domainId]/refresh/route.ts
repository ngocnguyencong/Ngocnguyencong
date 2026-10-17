import { NextResponse } from "next/server";

import { refreshWorkspaceDomain } from "../../../../../../src/custom-domains/domain-actions";

export const runtime = "nodejs";

/** Re-checks DNS verification for a custom domain (owner/admin only). */
export async function POST(_request: Request, context: { params: Promise<{ domainId: string }> }) {
  const { domainId } = await context.params;
  const result = await refreshWorkspaceDomain(domainId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ ok: true });
}
