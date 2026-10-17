import { beforeEach, describe, expect, it, vi } from "vitest";

const gate = vi.hoisted(() => ({
  captureException: vi.fn(),
  webhook: vi.fn(async () => ({ body: { ok: true }, status: 200 })),
}));

vi.mock("../../../../src/billing-runtime", () => ({
  creemBillingBff: { webhook: gate.webhook },
  dodoBillingBff: { webhook: gate.webhook },
  lemonSqueezyBillingBff: { webhook: gate.webhook },
  paddleBillingBff: { webhook: gate.webhook },
  polarBillingBff: { webhook: gate.webhook },
  stripeBillingBff: { webhook: gate.webhook },
  whopBillingBff: { webhook: gate.webhook },
}));
vi.mock("../../../../src/observability-runtime", () => ({
  serverObservability: { captureException: gate.captureException },
}));

import { POST as creemWebhook } from "./creem/route";
import { POST as dodoWebhook } from "./dodo/route";
import { POST as lemonSqueezyWebhook } from "./lemonsqueezy/route";
import { POST as paddleWebhook } from "./paddle/route";
import { POST as polarWebhook } from "./polar/route";
import { POST as stripeWebhook } from "./route";
import { POST as whopWebhook } from "./whop/route";

type RouteCase = Readonly<{
  headers: Record<string, string>;
  name: string;
  post: (request: Request) => Promise<Response>;
}>;

const STANDARD_HEADERS = {
  "webhook-id": "wh_1",
  "webhook-signature": "v1,sig",
  "webhook-timestamp": "1727300000",
};

const ROUTES: RouteCase[] = [
  { headers: { "stripe-signature": "sig_1" }, name: "stripe", post: stripeWebhook },
  { headers: { "creem-signature": "sig_1" }, name: "creem", post: creemWebhook },
  { headers: { ...STANDARD_HEADERS }, name: "dodo", post: dodoWebhook },
  { headers: { "x-signature": "sig_1" }, name: "lemonsqueezy", post: lemonSqueezyWebhook },
  { headers: { "paddle-signature": "sig_1" }, name: "paddle", post: paddleWebhook },
  { headers: { ...STANDARD_HEADERS }, name: "polar", post: polarWebhook },
  { headers: { ...STANDARD_HEADERS }, name: "whop", post: whopWebhook },
];

function requestFor(route: RouteCase, body: RequestInit["body"]): Request {
  return new Request(`https://app.test/api/billing/webhook/${route.name}`, {
    body,
    duplex: "half",
    headers: route.headers,
    method: "POST",
  } as RequestInit);
}

function failingStream(): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("{}"));
      controller.error(new Error("stream reset mid-body"));
    },
  });
}

beforeEach(() => {
  gate.captureException.mockClear();
  gate.webhook.mockClear();
});

describe.each(ROUTES)("billing webhook ingress ($name)", (route) => {
  it("returns 500 and reports when the body stream fails mid-read", async () => {
    const response = await route.post(requestFor(route, failingStream()));
    expect(response.status).toBe(500);
    expect(gate.webhook).not.toHaveBeenCalled();
    expect(gate.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        correlationId: expect.stringMatching(/^corr_/),
        operation: "billing.webhook.persist",
      }),
    );
  });

  it("still returns the bounded-reader response for an oversized payload", async () => {
    const response = await route.post(requestFor(route, "x".repeat(1_048_577)));
    expect(response.status).toBe(413);
    expect(gate.webhook).not.toHaveBeenCalled();
    expect(gate.captureException).not.toHaveBeenCalled();
  });

  it("passes a normal payload to the provider verifier with a per-request correlationId", async () => {
    const response = await route.post(requestFor(route, "{}"));
    expect(response.status).toBe(200);
    expect(gate.webhook).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: expect.stringMatching(/^corr_/),
        payload: "{}",
      }),
    );
  });
});
