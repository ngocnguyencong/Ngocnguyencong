import { beforeEach, describe, expect, it, vi } from "vitest";

const { getHandler, postHandler, limiterCheck } = vi.hoisted(() => ({
  getHandler: vi.fn(),
  postHandler: vi.fn(),
  limiterCheck: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: () => ({ GET: getHandler, POST: postHandler }),
}));
vi.mock("../../../../src/auth-runtime", () => ({ auth: {}, authjs: null }));
vi.mock("../../../../src/rate-limit-runtime", () => ({
  authLimiter: { check: limiterCheck },
  trustedProxyCount: 1,
  rateLimitTrustForwardedHeaders: false,
}));

import { GET, POST } from "./route";

describe("auth POST catch-all", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limiterCheck.mockResolvedValue({
      allowed: true,
      limit: 300,
      remaining: 299,
      retryAfterSeconds: 0,
    });
    getHandler.mockResolvedValue(new Response("get ok"));
  });

  it("applies the trusted-client window to GET routes and replaces forged canonical IPs", async () => {
    limiterCheck
      .mockResolvedValueOnce({
        allowed: true,
        limit: 300,
        remaining: 299,
        retryAfterSeconds: 0,
      })
      .mockResolvedValueOnce({
        allowed: false,
        limit: 300,
        remaining: 0,
        retryAfterSeconds: 10,
      });
    getHandler.mockImplementation(async (request: Request) =>
      Response.json({ clientIp: request.headers.get("x-authenticated-client-ip") }),
    );

    const first = await GET(
      new Request("https://app.test/api/auth/get-session", {
        headers: {
          "x-authenticated-client-ip": "198.51.100.55",
          "x-forwarded-for": "203.0.113.8",
        },
      }),
    );
    await expect(first.json()).resolves.toEqual({ clientIp: "203.0.113.8" });

    const second = await GET(
      new Request("https://app.test/api/auth/get-session", {
        headers: { "x-forwarded-for": "203.0.113.8" },
      }),
    );
    expect(second.status).toBe(429);
    expect(getHandler).toHaveBeenCalledTimes(1);
    expect(limiterCheck).toHaveBeenNthCalledWith(1, "auth:ip:203.0.113.8");
    expect(limiterCheck).toHaveBeenNthCalledWith(2, "auth:ip:203.0.113.8");
  });

  it("preserves a bounded request body and strips a caller-supplied canonical IP", async () => {
    const body = ' { "email": "é" }\n';
    postHandler.mockImplementation(async (request: Request) =>
      Response.json({
        body: await request.text(),
        contentType: request.headers.get("content-type"),
        clientIp: request.headers.get("x-authenticated-client-ip"),
        url: request.url,
      }),
    );

    const response = await POST(
      new Request("https://app.test/api/auth/callback/provider.name", {
        method: "POST",
        headers: {
          "content-type": "application/json; charset=utf-8",
          "x-authenticated-client-ip": "198.51.100.55",
        },
        body,
      }),
    );

    await expect(response.json()).resolves.toEqual({
      body,
      contentType: "application/json; charset=utf-8",
      clientIp: null,
      url: "https://app.test/api/auth/callback/provider.name",
    });
    expect(postHandler).toHaveBeenCalledTimes(1);
    expect(limiterCheck).not.toHaveBeenCalled();
  });

  it("returns 413 before delegation when actual request bytes exceed the auth cap", async () => {
    const response = await POST(
      new Request("https://app.test/api/auth/callback/provider.name", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "x".repeat(65_537),
      }),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "validationError" },
    });
    expect(postHandler).not.toHaveBeenCalled();
    expect(limiterCheck).not.toHaveBeenCalled();
  });
});
