import { NextResponse } from "next/server";

import { newCorrelationId } from "@supastack/observability";

import { paddleBillingBff } from "../../../../../src/billing-runtime";
import { serverObservability } from "../../../../../src/observability-runtime";
import { readWebhookPayload } from "../../../../../src/request-body";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (paddleBillingBff === null) {
    return NextResponse.json(
      {
        error: {
          code: "providerUnavailable",
          message: "Paddle billing is not configured for this deployment.",
        },
      },
      { status: 503 },
    );
  }

  const signature = request.headers.get("paddle-signature");
  if (signature === null || signature.trim() === "") {
    return NextResponse.json(
      { error: { code: "validationError", message: "The Paddle-Signature header is required." } },
      { status: 400 },
    );
  }

  // Minted per request so the failure capture, ledger write, and any emitted
  // workspace events all share one correlationId.
  const correlationId = newCorrelationId();

  try {
    const bounded = await readWebhookPayload(request);
    if ("response" in bounded) return bounded.response;
    const response = await paddleBillingBff.webhook({
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
          message: "The verified Paddle event could not be persisted.",
        },
      },
      { status: 500 },
    );
  }
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error("Unknown Paddle webhook failure");
}
