import { describe, expect, it, vi } from "vitest";

import { createRateLimiter } from "./rate-limit";
import {
  TRUSTED_CLIENT_IP_HEADER,
  createInFlightRequestGate,
  runRateLimitedRequest,
} from "./rate-limit-route";

vi.mock("server-only", () => ({}));

describe("runRateLimitedRequest", () => {
  function authRequest(headers = new Headers()) {
    return new Request("https://app.test/api/auth/sign-in/email", {
      method: "POST",
      headers,
      body: "{}",
    });
  }

  it("strips a forged internal IP and admits 31 sequential unknown-address requests", async () => {
    const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });
    const unknownIpGate = createInFlightRequestGate(1);
    const receivedClientIps: Array<string | null> = [];

    for (let index = 0; index < 31; index += 1) {
      const response = await runRateLimitedRequest(
        authRequest(new Headers({ "x-authenticated-client-ip": "198.51.100.77" })),
        limiter,
        "auth",
        async (downstreamRequest) => {
          receivedClientIps.push(downstreamRequest.headers.get(TRUSTED_CLIENT_IP_HEADER));
          expect(await downstreamRequest.text()).toBe("{}");
          return new Response("ok");
        },
        { unknownIpGate },
      );
      expect(response.status).toBe(200);
    }

    expect(receivedClientIps).toEqual(Array.from({ length: 31 }, () => null));
  });

  it("holds an unknown-address slot until the handler settles and releases it afterward", async () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    const unknownIpGate = createInFlightRequestGate(1);
    const firstResponse = new Response("first");
    let finishFirst!: () => void;

    const first = runRateLimitedRequest(
      authRequest(),
      limiter,
      "auth",
      () =>
        new Promise<Response>((resolve) => {
          finishFirst = () => resolve(firstResponse);
        }),
      { unknownIpGate },
    );
    const saturated = await runRateLimitedRequest(
      authRequest(),
      limiter,
      "auth",
      async () => new Response("unexpected"),
      { unknownIpGate },
    );
    expect(saturated.status).toBe(429);

    finishFirst();
    await expect(first).resolves.toBe(firstResponse);
    await expect(
      runRateLimitedRequest(
        authRequest(),
        limiter,
        "auth",
        async () => new Response("after release"),
        { unknownIpGate },
      ),
    ).resolves.toMatchObject({ status: 200 });
  });

  it("releases an unknown-address slot when the handler rejects", async () => {
    const unknownIpGate = createInFlightRequestGate(1);
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });

    await expect(
      runRateLimitedRequest(
        authRequest(),
        limiter,
        "auth",
        async () => {
          throw new Error("handler failed");
        },
        { unknownIpGate },
      ),
    ).rejects.toThrow("handler failed");
    await expect(
      runRateLimitedRequest(authRequest(), limiter, "auth", async () => new Response("recovered"), {
        unknownIpGate,
      }),
    ).resolves.toMatchObject({ status: 200 });
  });

  it("overwrites the canonical client IP from a trusted proxy and keeps its per-IP window", async () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    const unknownIpGate = createInFlightRequestGate(1);
    const options = { trustedProxyCount: 1, unknownIpGate };
    const observed: Array<string | null> = [];
    const handler = async (downstreamRequest: Request) => {
      observed.push(downstreamRequest.headers.get(TRUSTED_CLIENT_IP_HEADER));
      return new Response("ok");
    };
    const trustedRequest = (ip: string) =>
      authRequest(
        new Headers({
          "x-authenticated-client-ip": "192.0.2.99",
          "x-forwarded-for": ip,
        }),
      );

    await expect(
      runRateLimitedRequest(trustedRequest("203.0.113.8"), limiter, "auth", handler, options),
    ).resolves.toMatchObject({ status: 200 });
    await expect(
      runRateLimitedRequest(trustedRequest("203.0.113.8"), limiter, "auth", handler, options),
    ).resolves.toMatchObject({ status: 429 });
    await expect(
      runRateLimitedRequest(trustedRequest("203.0.113.9"), limiter, "auth", handler, options),
    ).resolves.toMatchObject({ status: 200 });
    expect(observed).toEqual(["203.0.113.8", "203.0.113.9"]);
  });
});
