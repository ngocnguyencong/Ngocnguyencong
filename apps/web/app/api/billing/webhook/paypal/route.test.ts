import { beforeEach, describe, expect, it, vi } from "vitest";

const gate = vi.hoisted(() => ({
  allowed: true,
  check: vi.fn(async () => ({ allowed: gate.allowed })),
  webhook: vi.fn(async () => ({ body: { data: { disposition: "ignored" } }, status: 200 })),
}));
vi.mock("../../../../../src/billing-runtime", () => ({
  paypalBillingBff: { webhook: gate.webhook },
}));
vi.mock("../../../../../src/rate-limit-runtime", () => ({
  paypalWebhookLimiter: { check: gate.check },
}));
vi.mock("../../../../../src/observability-runtime", () => ({
  serverObservability: { captureException: vi.fn() },
}));

import { POST } from "./route";

function headers() {
  return {
    "paypal-transmission-id": "t_1",
    "paypal-transmission-time": "2026-09-27T12:00:00Z",
    "paypal-transmission-sig": "invalid",
    "paypal-cert-url": "https://api.paypal.com/cert",
    "paypal-auth-algo": "SHA256withRSA",
  };
}

beforeEach(() => {
  gate.allowed = true;
  gate.check.mockClear();
  gate.webhook.mockClear();
});

describe("PayPal webhook ingress", () => {
  it("returns 429 without invoking verification when the global quota is exhausted", async () => {
    gate.allowed = false;
    const response = await POST(
      new Request("https://app.test/api/billing/webhook/paypal", {
        body: "{}",
        headers: headers(),
        method: "POST",
      }),
    );
    expect(response.status).toBe(429);
    expect(gate.webhook).not.toHaveBeenCalled();
    expect(gate.check).toHaveBeenCalledWith("all");
  });

  it("returns 413 before verification for an oversized payload", async () => {
    const response = await POST(
      new Request("https://app.test/api/billing/webhook/paypal", {
        body: "x".repeat(1_048_577),
        headers: headers(),
        method: "POST",
      }),
    );
    expect(response.status).toBe(413);
    expect(gate.webhook).not.toHaveBeenCalled();
  });

  it("passes a normal payload to the existing verifier", async () => {
    const response = await POST(
      new Request("https://app.test/api/billing/webhook/paypal", {
        body: "{}",
        headers: headers(),
        method: "POST",
      }),
    );
    expect(response.status).toBe(200);
    expect(gate.webhook).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: expect.stringMatching(/^corr_/),
        payload: "{}",
      }),
    );
  });
});
