import { NextResponse } from "next/server";

import { mobileOrganizationBff } from "../../../../src/mobile-organization";

export const runtime = "nodejs";

/** Creates + emails a workspace invitation (owner/admin only). */
export async function POST(request: Request) {
  let body: { email?: unknown; role?: unknown } = {};
  try {
    body = (await request.json()) as { email?: unknown; role?: unknown };
  } catch {
    body = {};
  }
  const response = await mobileOrganizationBff.invite(request.headers, {
    email: body.email,
    role: body.role,
  });
  return NextResponse.json(response.body, { status: response.status });
}
