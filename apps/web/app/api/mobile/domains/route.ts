import { NextResponse } from "next/server";

import {
  addWorkspaceDomain,
  listWorkspaceDomains,
} from "../../../../src/custom-domains/domain-actions";

export const runtime = "nodejs";

/** Lists custom domains for the caller's active workspace. */
export async function GET() {
  const result = await listWorkspaceDomains();
  if (result.error !== undefined) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }
  return NextResponse.json(result);
}

/** Adds a custom domain (owner/admin only). */
export async function POST(request: Request) {
  let body: { hostname?: unknown } = {};
  try {
    body = (await request.json()) as { hostname?: unknown };
  } catch {
    body = {};
  }
  const result = await addWorkspaceDomain({
    hostname: typeof body.hostname === "string" ? body.hostname : "",
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ ok: true });
}
