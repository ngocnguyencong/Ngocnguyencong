import { NextResponse } from "next/server";

import { productionAiTaskBff } from "../../../../src/ai-task-runtime";
import { serverObservability } from "../../../../src/observability-runtime";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (productionAiTaskBff === null) {
    return NextResponse.json(
      {
        error: { code: "providerUnavailable", message: "The production worker is not configured." },
      },
      { status: 503 },
    );
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "validationError", message: "A valid JSON body is required." } },
      { status: 400 },
    );
  }

  try {
    const response = await productionAiTaskBff.create(request.headers, input);
    return NextResponse.json(response.body, { status: response.status });
  } catch (error) {
    serverObservability.captureException(asError(error), {
      operation: "ai.task.enqueue",
      workspaceId: "system",
    });
    return NextResponse.json(
      { error: { code: "internalError", message: "The AI task could not be queued." } },
      { status: 500 },
    );
  }
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error("Unknown AI task enqueue failure");
}
