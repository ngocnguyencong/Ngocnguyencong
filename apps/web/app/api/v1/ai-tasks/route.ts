import { NextResponse } from "next/server";

import { apiV1Bff } from "../../../../src/api-v1-runtime";
import { apiV1Limiter } from "../../../../src/rate-limit-runtime";
import { rateLimitResponse } from "../../../../src/rate-limit-route";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = await rateLimitResponse(request.headers, apiV1Limiter, "api-v1");
  if (limited !== null) {
    return limited;
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const response = await apiV1Bff.createAiTask(request.headers, body);
  return NextResponse.json(response.body, { status: response.status });
}
