import { NextResponse } from "next/server";

import { mobileOrganizationBff } from "../../../../../src/mobile-organization";
import { getAuthSession } from "../../../../../src/auth-runtime";
import { readBoundedJson, RequestBodyTooLargeError } from "../../../../../src/request-body";

export const runtime = "nodejs";

/** Changes a member's role (owner/admin only). */
export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  if ((await getAuthSession(request.headers)) === null) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Sign in to manage members." } },
      { status: 401 },
    );
  }
  let body: { role?: unknown } = {};
  try {
    const value = await readBoundedJson(request);
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return NextResponse.json(
        { error: { code: "invalidInput", message: "A JSON object is required." } },
        { status: 400 },
      );
    }
    body = value;
  } catch (error) {
    if (!(error instanceof RequestBodyTooLargeError) && !(error instanceof SyntaxError))
      throw error;
    const status = error instanceof RequestBodyTooLargeError ? 413 : 400;
    return NextResponse.json(
      {
        error: {
          code: "invalidInput",
          message: status === 413 ? "The request body is too large." : "Invalid JSON.",
        },
      },
      { status },
    );
  }
  const { userId } = await context.params;
  const response = await mobileOrganizationBff.updateRole(request.headers, userId, {
    role: body.role,
  });
  return NextResponse.json(response.body, { status: response.status });
}

/** Removes a member from the active organization (owner/admin only). */
export async function DELETE(request: Request, context: { params: Promise<{ userId: string }> }) {
  const { userId } = await context.params;
  const response = await mobileOrganizationBff.removeMember(request.headers, userId);
  return NextResponse.json(response.body, { status: response.status });
}
