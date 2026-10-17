import { NextResponse } from "next/server";

import { encodePaypalWebhookSignature } from "@supastack/billing";
import { newCorrelationId } from "@supastack/observability";

import { paypalBillingBff } from "../../../../../src/billing-runtime";
import { serverObservability } from "../../../../../src/observability-runtime";
import { paypalWebhookLimiter } from "../../../../../src/rate-limit-runtime";
import { createConcurrentRequestGate, readWebhookPayload } from "../../../../../src/request-body";

export const runtime = "nodejs";
const verificationGate = createConcurrentRequestGate(20);

export async function POST(request: Request) {
  if (paypalBillingBff === null) {
    return NextResponse.json(
      {
        error: {
          code: "providerUnavailable",
          message: "PayPal billing is not configured for this deployment.",
        },
      },
      { status: 503 },
    );
  }
  const billingBff = paypalBillingBff;

  const signature = paypalWebhookSignature(request.headers);
  if (signature === null) {
    return NextResponse.json(
      {
        error: {
          code: "validationError",
          message:
            "The PayPal-Transmission-Id, PayPal-Transmission-Time, PayPal-Transmission-Sig, PayPal-Cert-Url and PayPal-Auth-Algo headers are required.",
        },
      },
      { status: 400 },
    );
  }

  if (!(await paypalWebhookLimiter.check("all")).allowed) {
    return NextResponse.json(
      { error: { code: "rateLimited", message: "Too many webhook requests." } },
      { status: 429 },
    );
  }

  // Minted per request so the failure capture, ledger write, and any emitted
  // workspace events all share one correlationId.
  const correlationId = newCorrelationId();

  try {
    const response = await verificationGate.run(async () => {
      const bounded = await readWebhookPayload(request);
      if ("response" in bounded) return bounded.response;
      return billingBff.webhook({ correlationId, payload: bounded.payload, signature });
    });
    if (response === null) {
      return NextResponse.json(
        { error: { code: "rateLimited", message: "Too many concurrent webhook requests." } },
        { status: 429 },
      );
    }
    if (response instanceof Response) return response;
    return NextResponse.json(response.body, { status: response.status });
  } catch (error) {
    serverObservability.captureException(asError(error), {
      correlationId,
      operation: "billing.webhook.persist",
      workspaceId: "system",
    });
    return NextResponse.json(
      {
        error: {
          code: "internalError",
          message: "The verified PayPal event could not be persisted.",
        },
      },
      { status: 500 },
    );
  }
}

function paypalWebhookSignature(headers: Headers): string | null {
  const names = [
    "paypal-transmission-id",
    "paypal-transmission-time",
    "paypal-transmission-sig",
    "paypal-cert-url",
    "paypal-auth-algo",
  ] as const;
  const values = names.map((name) => headers.get(name));
  if (values.some((value) => value === null || value.trim() === "" || value.length > 2_048)) {
    return null;
  }
  return encodePaypalWebhookSignature(
    Object.fromEntries(names.map((name, index) => [name, values[index] as string])),
  );
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error("Unknown PayPal webhook failure");
}
