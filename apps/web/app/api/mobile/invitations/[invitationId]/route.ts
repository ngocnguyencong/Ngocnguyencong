import { NextResponse } from "next/server";

import { mobileOrganizationBff } from "../../../../../src/mobile-organization";

export const runtime = "nodejs";

/** Revokes a pending invitation (owner/admin only). */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ invitationId: string }> },
) {
  const { invitationId } = await context.params;
  const response = await mobileOrganizationBff.revokeInvite(request.headers, invitationId);
  return NextResponse.json(response.body, { status: response.status });
}
