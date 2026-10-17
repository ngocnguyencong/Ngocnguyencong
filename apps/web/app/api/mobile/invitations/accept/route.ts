import { NextResponse } from "next/server";

import { mobileOrganizationBff } from "../../../../../src/mobile-organization";
import { ACTIVE_WORKSPACE_COOKIE } from "../../../../../src/organization-constants";

export const runtime = "nodejs";

/** Accepts a workspace invitation token for the signed-in user. */
export async function POST(request: Request) {
  let body: { token?: unknown } = {};
  try {
    body = (await request.json()) as { token?: unknown };
  } catch {
    body = {};
  }
  const response = await mobileOrganizationBff.acceptInvite(request.headers, {
    token: body.token,
  });
  const json = NextResponse.json(response.body, { status: response.status });
  if (response.status === 200 && "data" in response.body) {
    // Cookie for clients that persist cookies; the userWorkspacePreference
    // write in the BFF covers cookie-less clients.
    json.cookies.set(ACTIVE_WORKSPACE_COOKIE, response.body.data.workspaceId, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    });
  }
  return json;
}
