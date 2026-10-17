import { afterEach, describe, expect, it, vi } from "vitest";

import { MAX_JSON_BODY_BYTES } from "../../../../src/request-body";

const authenticate = vi.hoisted(() =>
  vi.fn(async () => ({
    entitlement: { key: "reference-ai", state: "active", workspaceId: "ws_1" },
    sessionToken: "session_1",
    workspace: { id: "ws_1", name: "Test workspace", workspaceId: "ws_1" },
  })),
);

vi.mock("../../../../src/local-golden-server", () => ({
  authenticateLocalReferenceUser: authenticate,
  enqueueLocalReferenceTask: vi.fn(),
  getLocalReferenceTask: vi.fn(),
  hydrateLocalReferenceSession: vi.fn(),
  runLocalReferenceTask: vi.fn(),
}));

import { GET, POST } from "./route";

const context = (action: string) => ({ params: Promise.resolve({ action }) });

function oversizedJsonRequest(url: string, payload: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.subarray(0, 12));
      controller.enqueue(bytes.subarray(12, MAX_JSON_BODY_BYTES + 1));
      controller.enqueue(bytes.subarray(MAX_JSON_BODY_BYTES + 1));
      controller.close();
    },
  });
  return new Request(url, {
    body,
    duplex: "half",
    headers: { "content-length": "1", "content-type": "application/json" },
    method: "POST",
  } as RequestInit);
}

afterEach(() => {
  vi.unstubAllEnvs();
  authenticate.mockClear();
});

describe("local reference route exposure", () => {
  it("rejects production POST before creating local state", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await POST(
      new Request("https://app.example.test/api/local-reference/authenticate", {
        body: JSON.stringify({ email: "a@example.test", name: "A" }),
        method: "POST",
      }),
      context("authenticate"),
    );

    expect(response.status).toBe(404);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("rejects production GET before reading a local session", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await GET(
      new Request("https://app.example.test/api/local-reference/hydrate"),
      context("hydrate"),
    );

    expect(response.status).toBe(404);
  });

  it("keeps the local authentication flow available during development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const response = await POST(
      new Request("http://localhost:3000/api/local-reference/authenticate", {
        body: JSON.stringify({ email: "a@example.test", name: "A" }),
        method: "POST",
      }),
      context("authenticate"),
    );

    expect(response.status).toBe(200);
    expect(authenticate).toHaveBeenCalledWith({ email: "a@example.test", name: "A" });
    expect(response.headers.get("set-cookie")).toContain("supastack.localReferenceSession");
  });

  it("rejects oversized development JSON before creating local state", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const response = await POST(
      oversizedJsonRequest("http://localhost:3000/api/local-reference/authenticate", {
        email: "x".repeat(MAX_JSON_BODY_BYTES),
        name: "A",
      }),
      context("authenticate"),
    );

    expect(response.status).toBe(413);
    expect(authenticate).not.toHaveBeenCalled();
  });
});
