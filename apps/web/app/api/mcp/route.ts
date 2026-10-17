import { createToolRegistry } from "@supastack/agents";

import packageJson from "../../../package.json";
import { resolveApiKeyCaller } from "../../../src/api-key-auth";
import { apiV1Bff } from "../../../src/api-v1-runtime";
import { handleMcpRequest } from "../../../src/mcp-server";
import { rateLimitResponse } from "../../../src/rate-limit-route";
import { apiV1Limiter } from "../../../src/rate-limit-runtime";
import { createWorkspaceTools } from "../../../src/workspace-tools";
import { createSupadataTools } from "../../../src/supadata/mcp-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = await rateLimitResponse(request.headers, apiV1Limiter, "api-v1");
  if (limited !== null) {
    return limited;
  }
  return handleMcpRequest(request, {
    registry: createToolRegistry([
      ...createWorkspaceTools({ bff: apiV1Bff, headers: request.headers }),
      ...createSupadataTools(),
    ]),
    resolveCaller: resolveApiKeyCaller,
    version: packageJson.version,
  });
}

export function GET() {
  return Response.json(
    { error: { code: "methodNotAllowed", message: "Only POST is supported." } },
    { headers: { allow: "POST" }, status: 405 },
  );
}

export function DELETE() {
  return GET();
}
