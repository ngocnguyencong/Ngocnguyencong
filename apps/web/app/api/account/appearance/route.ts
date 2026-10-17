import { NextResponse } from "next/server";

import { parseServerConfig } from "@supastack/config";

import { getAuthSession } from "../../../../src/auth-runtime";
import { getUserAppearance, saveUserAppearance } from "../../../../src/appearance-sync";
import { readBoundedJson, RequestBodyTooLargeError } from "../../../../src/request-body";
import { parseAppearancePreferences } from "../../../../src/theme/appearance";

export const runtime = "nodejs";

const serverConfig = parseServerConfig();
const NO_STORE = { "Cache-Control": "no-store" };

function unauthorized() {
  return NextResponse.json(
    { error: { code: "unauthorized", message: "Authentication is required." } },
    { headers: NO_STORE, status: 401 },
  );
}

function hasTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(serverConfig.app.webUrl).origin;
}

/** The signed-in user's synced appearance snapshot (web + desktop webview). */
export async function GET(request: Request) {
  const session = await getAuthSession(request.headers);
  if (session === null) {
    return unauthorized();
  }
  const snapshot = await getUserAppearance(session.user.id);
  return NextResponse.json(
    {
      preferences: snapshot.preferences,
      updatedAt: snapshot.updatedAt === null ? null : snapshot.updatedAt.toISOString(),
    },
    { headers: NO_STORE },
  );
}

/** Replaces the signed-in user's synced appearance snapshot. Same-origin only. */
export async function PUT(request: Request) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "This request is not same-origin." } },
      { headers: NO_STORE, status: 403 },
    );
  }
  const session = await getAuthSession(request.headers);
  if (session === null) {
    return unauthorized();
  }

  let body: unknown;
  try {
    body = await readBoundedJson(request);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json(
        { error: { code: "validationError", message: "The request body is too large." } },
        { headers: NO_STORE, status: 413 },
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: { code: "invalidJson", message: "Invalid JSON." } },
        { headers: NO_STORE, status: 400 },
      );
    }
    throw error;
  }

  const preferences =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? parseAppearancePreferences((body as Record<string, unknown>).preferences)
      : null;
  if (preferences === null) {
    return NextResponse.json(
      { error: { code: "invalidPreferences", message: "The appearance preferences are invalid." } },
      { headers: NO_STORE, status: 400 },
    );
  }

  const saved = await saveUserAppearance(session.user.id, preferences);
  return NextResponse.json(
    { preferences: saved.preferences, updatedAt: saved.updatedAt.toISOString() },
    { headers: NO_STORE },
  );
}
