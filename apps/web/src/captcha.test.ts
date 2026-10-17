import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createCaptchaVerifier, createTurnstileVerifier, TURNSTILE_VERIFY_URL } from "./captcha";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("createCaptchaVerifier", () => {
  it("always passes when the provider is off — no token, no fetch", async () => {
    const verifier = createCaptchaVerifier({ kind: "off" });
    await expect(verifier.verify(undefined)).resolves.toBe(true);
  });

  it("verifies through siteverify when the provider is turnstile", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ success: true }));
    const verifier = createCaptchaVerifier(
      { kind: "turnstile", secretKey: "s", siteKey: "k" },
      { fetchImpl },
    );

    await expect(verifier.verify("token")).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

describe("createTurnstileVerifier", () => {
  it("rejects a missing token without calling siteverify", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const verifier = createTurnstileVerifier({
      secretKey: "secret",
      fetchImpl,
    });

    await expect(verifier.verify(undefined)).resolves.toBe(false);
    await expect(verifier.verify("")).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts secret, response, and remoteip and returns the success flag", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ success: true }));
    const verifier = createTurnstileVerifier({
      secretKey: "turnstile-secret",
      fetchImpl,
    });

    await expect(verifier.verify("token-123", "203.0.113.7")).resolves.toBe(true);

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(TURNSTILE_VERIFY_URL);
    const body = init?.body as URLSearchParams;
    expect(body.get("secret")).toBe("turnstile-secret");
    expect(body.get("response")).toBe("token-123");
    expect(body.get("remoteip")).toBe("203.0.113.7");
  });

  it("omits remoteip when no client IP is known", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ success: true }));
    const verifier = createTurnstileVerifier({ secretKey: "s", fetchImpl });

    await verifier.verify("token");
    const body = (fetchImpl.mock.calls[0]?.[1]?.body ?? null) as URLSearchParams;
    expect(body.get("remoteip")).toBeNull();
  });

  it("fails closed on success:false, non-200, and network errors", async () => {
    const denied = createTurnstileVerifier({
      secretKey: "s",
      fetchImpl: vi.fn<typeof fetch>(async () =>
        jsonResponse({ success: false, "error-codes": ["invalid-input-response"] }),
      ),
    });
    await expect(denied.verify("bad-token")).resolves.toBe(false);

    const httpError = createTurnstileVerifier({
      secretKey: "s",
      fetchImpl: vi.fn<typeof fetch>(async () => jsonResponse({}, 500)),
    });
    await expect(httpError.verify("token")).resolves.toBe(false);

    const networkError = createTurnstileVerifier({
      secretKey: "s",
      fetchImpl: vi.fn<typeof fetch>(async () => {
        throw new Error("connection reset");
      }),
    });
    await expect(networkError.verify("token")).resolves.toBe(false);
  });
});
