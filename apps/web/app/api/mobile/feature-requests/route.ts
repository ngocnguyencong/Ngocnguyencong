import { NextResponse } from "next/server";

import { mobileFeatureBoardBff } from "../../../../src/mobile-feature-board";

export async function GET(request: Request) {
  const response = await mobileFeatureBoardBff.list(request.headers);
  return NextResponse.json(response.body, { status: response.status });
}

export async function POST(request: Request) {
  let body: { details?: unknown; title?: unknown };
  try {
    body = (await request.json()) as { details?: unknown; title?: unknown };
  } catch {
    body = {};
  }
  const response = await mobileFeatureBoardBff.create(request.headers, {
    details: typeof body.details === "string" ? body.details : undefined,
    title: typeof body.title === "string" ? body.title : undefined,
  });
  return NextResponse.json(response.body, { status: response.status });
}
