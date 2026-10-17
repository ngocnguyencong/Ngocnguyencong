import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  authenticateLocalReferenceUser,
  enqueueLocalReferenceTask,
  getLocalReferenceTask,
  hydrateLocalReferenceSession,
  runLocalReferenceTask,
} from "../../../../src/local-golden-server";
import { readBoundedJson, RequestBodyTooLargeError } from "../../../../src/request-body";

const localReferenceSessionCookie = "supastack.localReferenceSession";

type RouteContext = Readonly<{ params: Promise<{ action: string }> }>;

export async function POST(request: Request, context: RouteContext) {
  if (process.env.NODE_ENV === "production") {
    return errorResponse("notFound", "The requested local reference action does not exist.", 404);
  }
  const { action } = await context.params;
  let payload: unknown = null;
  try {
    payload = await readBoundedJson(request);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return errorResponse("validationError", "The request body is too large.", 413);
    }
  }

  if (!isRecord(payload)) {
    return errorResponse(
      "validationError",
      "Send a JSON object to the local reference route.",
      400,
    );
  }

  try {
    if (action === "authenticate") {
      const email = requireString(payload, "email");
      const name = requireString(payload, "name");
      const authenticated = await authenticateLocalReferenceUser({ email, name });
      const response = NextResponse.json({
        entitlement: authenticated.entitlement,
        workspace: authenticated.workspace,
      });

      response.cookies.set({
        httpOnly: true,
        maxAge: 60 * 60,
        name: localReferenceSessionCookie,
        path: "/",
        sameSite: "lax",
        value: authenticated.sessionToken,
      });

      return response;
    }

    const sessionToken = await requireSessionToken();

    if (action === "task") {
      return NextResponse.json(
        await enqueueLocalReferenceTask({
          prompt: requireString(payload, "prompt"),
          sessionToken,
        }),
        { status: 201 },
      );
    }

    if (action === "run") {
      return NextResponse.json(
        await runLocalReferenceTask({
          sessionToken,
          taskId: requireString(payload, "taskId"),
        }),
      );
    }

    return errorResponse("notFound", "The requested local reference action does not exist.", 404);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function GET(request: Request, context: RouteContext) {
  if (process.env.NODE_ENV === "production") {
    return errorResponse("notFound", "The requested local reference action does not exist.", 404);
  }
  const { action } = await context.params;

  if (action !== "hydrate" && action !== "task") {
    return errorResponse("notFound", "The requested local reference action does not exist.", 404);
  }

  try {
    const sessionToken = await requireSessionToken();

    if (action === "hydrate") {
      return NextResponse.json(await hydrateLocalReferenceSession({ sessionToken }));
    }

    const taskId = new URL(request.url).searchParams.get("taskId");

    if (taskId === null || taskId.trim().length === 0) {
      return errorResponse("validationError", "Provide a local task ID.", 400);
    }

    return NextResponse.json(await getLocalReferenceTask({ sessionToken, taskId }));
  } catch (error) {
    return toErrorResponse(error);
  }
}

async function requireSessionToken(): Promise<string> {
  const sessionToken = (await cookies()).get(localReferenceSessionCookie)?.value;

  if (sessionToken === undefined) {
    throw new LocalRouteError(
      "unauthorized",
      "Start the local reference flow before creating a task.",
      401,
    );
  }

  return sessionToken;
}

function requireString(payload: Record<string, unknown>, field: string): string {
  const value = payload[field];

  if (typeof value !== "string") {
    throw new LocalRouteError("validationError", `Provide a ${field} value.`, 400);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class LocalRouteError extends Error {
  constructor(
    readonly code: "validationError" | "unauthorized",
    message: string,
    readonly status: 400 | 401,
  ) {
    super(message);
    this.name = "LocalRouteError";
  }
}

function toErrorResponse(error: unknown) {
  if (error instanceof LocalRouteError) {
    return errorResponse(error.code, error.message, error.status);
  }

  return errorResponse("internalError", "The local reference action could not be completed.", 500);
}

function errorResponse(
  code: "validationError" | "unauthorized" | "notFound" | "internalError",
  message: string,
  status: 400 | 401 | 404 | 413 | 500,
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        requestId: crypto.randomUUID(),
      },
    },
    { status },
  );
}
