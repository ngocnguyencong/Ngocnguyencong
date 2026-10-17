import { NextResponse } from "next/server";

import { apiV1Bff } from "../../../../../src/api-v1-runtime";
import { apiV1Limiter } from "../../../../../src/rate-limit-runtime";
import { rateLimitResponse } from "../../../../../src/rate-limit-route";

export const runtime = "nodejs";

type RouteContext = Readonly<{ params: Promise<{ taskId: string }> }>;

export async function GET(request: Request, context: RouteContext) {
  const limited = await rateLimitResponse(request.headers, apiV1Limiter, "api-v1");
  if (limited !== null) {
    return limited;
  }
  const { taskId } = await context.params;
  const response = await apiV1Bff.readAiTask(request.headers, taskId);
  return NextResponse.json(response.body, { status: response.status });
}
