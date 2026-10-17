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
    const response = await activeBillingBff.portal(request.headers);
    return NextResponse.json(response.body, { status: response.status });
  } catch (error) {
    serverObservability.captureException(asError(error), {
      operation: "billing.portal",
      workspaceId: "system",
    });
    return NextResponse.json(
      { error: { code: "internalError", message: "Customer Portal could not be opened." } },
      { status: 500 },
    );
  }
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error("Unknown Customer Portal failure");
}
