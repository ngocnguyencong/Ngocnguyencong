import { NextResponse } from "next/server";

import { activeBillingBff } from "../../../../src/billing-runtime";
import { serverObservability } from "../../../../src/observability-runtime";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (activeBillingBff === null) {
    return NextResponse.json(
      {
        error: {
          code: "providerUnavailable",
          message: "Billing is not configured for this deployment.",
        },
      },
      { status: 503 },
    );
  }

  try {
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    const response = await activeBillingBff.checkout(request.headers, body);
    return NextResponse.json(response.body, { status: response.status });
  } catch (error) {
    serverObservability.captureException(asError(error), {
      operation: "billing.checkout",
      workspaceId: "system",
    });
    return NextResponse.json(
      { error: { code: "internalError", message: "Checkout could not be created." } },
      { status: 500 },
    );
  }
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error("Unknown Checkout failure");
}
