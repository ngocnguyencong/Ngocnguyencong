import { NextResponse } from "next/server";

import { apiV1Bff } from "../../../../src/api-v1-runtime";

export const runtime = "nodejs";

export async function GET() {
  const response = apiV1Bff.openapi();
  return NextResponse.json(response.body, { status: response.status });
}
