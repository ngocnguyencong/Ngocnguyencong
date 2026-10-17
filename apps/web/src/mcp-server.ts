import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { randomUUID } from "node:crypto";

import {
  executeToolCall,
  type ToolContext,
  type ToolRegistry,
  type ToolScope,
} from "@supastack/agents";

import type { ApiV1ApiKeyCaller } from "./api-v1-bff";
import { WorkspaceToolError } from "./workspace-tools";

export type McpCaller = ApiV1ApiKeyCaller;

export interface McpServerDependencies {
  registry: ToolRegistry;
  resolveCaller(headers: Headers): Promise<McpCaller | "invalid" | null>;
  version: string;
}

function jsonResponse(body: unknown, init: ResponseInit): Response {
  return Response.json(body, init);
}

function unauthorized(): Response {
  return jsonResponse(
    {
      error: {
        code: "unauthorized",
        message: "A valid sk_ API key is required.",
        requestId: randomUUID(),
      },
    },
    { headers: { "WWW-Authenticate": "Bearer" }, status: 401 },
  );
}

function methodNotAllowed(): Response {
  return jsonResponse(
    {
      error: {
        code: "methodNotAllowed",
        message: "The MCP endpoint is stateless; only POST is supported.",
        requestId: randomUUID(),
      },
    },
    { headers: { allow: "POST" }, status: 405 },
  );
}

function asToolScopes(scopes: readonly string[]): ToolScope[] {
  return scopes.filter((scope): scope is ToolScope => scope === "read" || scope === "write");
}

/**
 * Stateless Streamable HTTP MCP endpoint. API-key auth only — cookie sessions
 * never apply. A fresh server + transport per request keeps the endpoint
 * stateless; tools come from the shared registry filtered by key scopes, and
 * every call runs through the shared executeToolCall wrapper (zod validation,
 * scope enforcement, context injection).
 */
export async function handleMcpRequest(
  request: Request,
  dependencies: McpServerDependencies,
): Promise<Response> {
  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  const caller = await dependencies.resolveCaller(request.headers);
  if (caller === null || caller === "invalid") {
    return unauthorized();
  }

  const scopes = asToolScopes(caller.scopes);
  const context: ToolContext = Object.freeze({
    scopes,
    userId: caller.userId,
    workspaceId: caller.workspace.workspaceId,
  });

  const server = new McpServer({ name: "supastack", version: dependencies.version });
  for (const tool of dependencies.registry.forScopes(scopes)) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        title: tool.title,
      },
      async (args) => {
        try {
          const output = await executeToolCall(tool, args, context, []);
          return { content: [{ text: JSON.stringify(output), type: "text" as const }] };
        } catch (error) {
          const message =
            error instanceof WorkspaceToolError ? error.message : "The tool call failed.";
          return {
            content: [{ text: message, type: "text" as const }],
            isError: true,
          };
        }
      },
    );
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}
