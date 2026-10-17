import { NextResponse } from "next/server";

import { createApiKeyAction, listWorkspaceApiKeys } from "../../../../src/api-keys-actions";

export const runtime = "nodejs";

/** Lists API keys for the caller's active workspace (owner/admin only). */
export async function GET() {
  const result = await listWorkspaceApiKeys();
  if (result.error !== undefined) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }
  return NextResponse.json({ keys: result.keys, manageable: result.manageable });
}

/** Creates an API key; the plaintext secret is returned exactly once. */
export async function POST(request: Request) {
  let body: { expiresInDays?: unknown; name?: unknown; scopes?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const result = await createApiKeyAction({
    ...(typeof body.expiresInDays === "number" ? { expiresInDays: body.expiresInDays } : {}),
    name: typeof body.name === "string" ? body.name : "",
    scopes: Array.isArray(body.scopes)
      ? body.scopes.filter((scope): scope is string => typeof scope === "string")
      : [],
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ keyId: result.keyId, plaintext: result.plaintext }, { status: 201 });
}
