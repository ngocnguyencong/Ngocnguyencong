import { NextResponse } from "next/server";

import { productionAiTaskBff } from "../../../../../src/ai-task-runtime";
import { serverObservability } from "../../../../../src/observability-runtime";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ taskId: string }> }) {
  if (productionAiTaskBff === null) {
    return NextResponse.json(
      {
        error: { code: "providerUnavailable", message: "The production worker is not configured." },
      },
      { status: 503 },
    );
  }

  try {
    const { taskId } = await context.params;
    const response = await productionAiTaskBff.read(request.headers, taskId);
    return NextResponse.json(response.body, { status: response.status });
  } catch {
    try {
      serverObservability.captureException(new Error("AI task read failed"), {
        operation: "ai.task.read",
        workspaceId: "system",
      });
    } catch {
      // Reporting must not replace the safe HTTP error boundary.
    }
    return NextResponse.json(
      { error: { code: "internalError", message: "The AI task could not be loaded." } },
      { status: 500 },
    );
  }
}
