import { NextResponse } from "next/server";

import { mobileFeatureBoardBff } from "../../../../../../src/mobile-feature-board";

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await context.params;
  const response = await mobileFeatureBoardBff.vote(request.headers, requestId);
  return NextResponse.json(response.body, { status: response.status });
}
