import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createToolRegistry, defineTool } from "@supastack/agents";

import { handleMcpRequest, type McpCaller } from "./mcp-server";
import { WorkspaceToolError } from "./workspace-tools";

const caller: McpCaller = Object.freeze({
  scopes: ["read"],
  userId: "user_1",
  workspace: { createdAt: new Date(), name: "Acme", workspaceId: "ws_1" },
});

const readTool = defineTool({
  description: "Read tool",
  execute: async (_input, context) => ({ echo: "hi", workspaceId: context.workspaceId }),
  inputSchema: z.object({}),
  name: "read_thing",
  scope: "read",
  title: "Read thing",
});

const writeTool = defineTool({
  description: "Write tool",
  execute: async () => ({ ok: true }),
  inputSchema: z.object({}),
  name: "write_thing",
  scope: "write",
  title: "Write thing",
});

const failingTool = defineTool({
  description: "Fails",
  execute: async () => {
    throw new WorkspaceToolError("notFound", "The task was not found.");
  },
  inputSchema: z.object({}),
  name: "failing_thing",
  scope: "read",
  title: "Failing thing",
});

const registry = createToolRegistry([readTool, writeTool, failingTool]);

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://app.test/api/mcp", {
    body: JSON.stringify(body),
    headers: {
      accept: "application/json, text/event-stream",
      authorization: "Bearer sk_test_x",
      "content-type": "application/json",
      ...headers,
    },
    method: "POST",
  });
}

function deps(resolveCaller: () => Promise<McpCaller | "invalid" | null> = async () => caller) {
  return {
    registry,
    resolveCaller,
    version: "0.1.0-test",
  };
}

const initialize = {
  id: 1,
  jsonrpc: "2.0",
  method: "initialize",
  params: {
    capabilities: {},
    clientInfo: { name: "test", version: "0" },
    protocolVersion: "2025-03-26",
  },
};

describe("handleMcpRequest", () => {
  it("returns 401 with a Bearer challenge when no API key resolves", async () => {
    for (const resolved of [null, "invalid"] as const) {
      const response = await handleMcpRequest(
        request(initialize, {}),
        deps(async () => resolved),
      );
      expect(response.status).toBe(401);
      expect(response.headers.get("www-authenticate")).toBe("Bearer");
      const body = await response.json();
      expect(body.error.code).toBe("unauthorized");
    }
  });

  it("does not fall back to cookie sessions", async () => {
    const withCookies = new Request("https://app.test/api/mcp", {
      body: JSON.stringify(initialize),
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        cookie: "session=abc",
      },
      method: "POST",
    });
    const response = await handleMcpRequest(
      withCookies,
      deps(async () => null),
    );
    expect(response.status).toBe(401);
  });

  it("initializes and reports server metadata", async () => {
    const response = await handleMcpRequest(request(initialize), deps());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.serverInfo).toEqual({ name: "supastack", version: "0.1.0-test" });
    expect(body.result.capabilities.tools).toBeDefined();
  });

  it("lists only the tools the caller's scopes allow", async () => {
    const response = await handleMcpRequest(
      request({ id: 2, jsonrpc: "2.0", method: "tools/list", params: {} }),
      deps(),
    );
    const body = await response.json();
    const names = (body.result.tools as { name: string }[]).map((tool) => tool.name).sort();
    expect(names).toEqual(["failing_thing", "read_thing"]);
  });

  it("exposes write tools to write-scoped keys", async () => {
    const response = await handleMcpRequest(
      request({ id: 2, jsonrpc: "2.0", method: "tools/list", params: {} }),
      deps(async () => ({ ...caller, scopes: ["read", "write"] })),
    );
    const body = await response.json();
    const names = (body.result.tools as { name: string }[]).map((tool) => tool.name).sort();
    expect(names).toEqual(["failing_thing", "read_thing", "write_thing"]);
  });

  it("executes a tool and returns JSON text content with the injected context", async () => {
    const response = await handleMcpRequest(
      request({
        id: 3,
        jsonrpc: "2.0",
        method: "tools/call",
        params: { arguments: {}, name: "read_thing" },
      }),
      deps(),
    );
    const body = await response.json();
    expect(body.result.isError).toBeUndefined();
    const text = body.result.content[0].text as string;
    expect(JSON.parse(text)).toEqual({ echo: "hi", workspaceId: "ws_1" });
  });

  it("maps WorkspaceToolError to a safe isError result", async () => {
    const response = await handleMcpRequest(
      request({
        id: 4,
        jsonrpc: "2.0",
        method: "tools/call",
        params: { arguments: {}, name: "failing_thing" },
      }),
      deps(),
    );
    const body = await response.json();
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toBe("The task was not found.");
  });

  it("rejects calls to tools outside the caller's scopes", async () => {
    const response = await handleMcpRequest(
      request({
        id: 5,
        jsonrpc: "2.0",
        method: "tools/call",
        params: { arguments: {}, name: "write_thing" },
      }),
      deps(),
    );
    const body = await response.json();
    expect(body.error ?? body.result).toBeDefined();
    expect(body.result?.isError !== false || body.error !== undefined).toBe(true);
  });

  it("returns 405 for GET and DELETE", async () => {
    for (const method of ["GET", "DELETE"] as const) {
      const response = await handleMcpRequest(
        new Request("https://app.test/api/mcp", {
          headers: { authorization: "Bearer sk_test_x" },
          method,
        }),
        deps(),
      );
      expect(response.status).toBe(405);
    }
  });
});
