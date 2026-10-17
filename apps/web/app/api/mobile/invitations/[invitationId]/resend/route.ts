import { NextResponse } from "next/server";

import { mobileOrganizationBff } from "../../../../../../src/mobile-organization";

export const runtime = "nodejs";

/** Resends a pending invitation email (owner/admin only). */
export async function POST(
  request: Request,
  context: { params: Promise<{ invitationId: string }> },
) {
  const { invitationId } = await context.params;
  const response = await mobileOrganizationBff.resendInvite(request.headers, invitationId);
  return NextResponse.json(response.body, { status: response.status });
}
