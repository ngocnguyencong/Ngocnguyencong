import { NextResponse } from "next/server";

import { encodeStandardWebhookSignature } from "@supastack/billing";
import { newCorrelationId } from "@supastack/observability";

import { polarBillingBff } from "../../../../../src/billing-runtime";
import { serverObservability } from "../../../../../src/observability-runtime";
import { readWebhookPayload } from "../../../../../src/request-body";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (polarBillingBff === null) {
    return NextResponse.json(
      {
        error: {
          code: "providerUnavailable",
          message: "Polar billing is not configured for this deployment.",
        },
      },
      { status: 503 },
    );
  }

  const signature = standardWebhookSignature(request.headers);
  if (signature === null) {
    return NextResponse.json(
      {
        error: {
          code: "validationError",
          message: "The webhook-id, webhook-timestamp and webhook-signature headers are required.",
        },
      },
      { status: 400 },
    );
  }

  // Minted per request so the failure capture, ledger write, and any emitted
  // workspace events all share one correlationId.
  const correlationId = newCorrelationId();

  try {
    const bounded = await readWebhookPayload(request);
    if ("response" in bounded) return bounded.response;
    const response = await polarBillingBff.webhook({
      correlationId,
      payload: bounded.payload,
      signature,
    });
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
          message: "The verified Polar event could not be persisted.",
        },
      },
      { status: 500 },
    );
  }
}

function standardWebhookSignature(headers: Headers): string | null {
  const values = ["webhook-id", "webhook-timestamp", "webhook-signature"].map((name) =>
    headers.get(name),
  );
  if (values.some((value) => value === null || value.trim() === "")) {
    return null;
  }
  return encodeStandardWebhookSignature({
    "webhook-id": values[0] as string,
    "webhook-timestamp": values[1] as string,
    "webhook-signature": values[2] as string,
  });
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error("Unknown Polar webhook failure");
}
