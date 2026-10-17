import { NextResponse } from "next/server";

import { mobileOrganizationBff } from "../../../../../src/mobile-organization";

export const runtime = "nodejs";

/** The signed-in member leaves the active organization. */
export async function POST(request: Request) {
  const response = await mobileOrganizationBff.leave(request.headers);
  return NextResponse.json(response.body, { status: response.status });
}
