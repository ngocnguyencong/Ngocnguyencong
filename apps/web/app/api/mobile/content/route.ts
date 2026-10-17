import { NextResponse } from "next/server";

import { createContentEntryAction, listContentEntries } from "../../../../src/content-actions";
import { readBoundedJson, RequestBodyTooLargeError } from "../../../../src/request-body";
import { requireWorkspaceWriter } from "../../../../src/workspace-access";

export const runtime = "nodejs";

/** Entry bodies can carry long Markdown — 1 MiB matches the webhook cap. */
const MAX_CONTENT_BODY_BYTES = 1_048_576;

function writerErrorResponse(error: string) {
  return NextResponse.json({ error }, { status: error === "Sign in required." ? 401 : 403 });
}

/**
 * `GET /api/mobile/content` — CMS entries for the caller's active
 * workspace, newest first. Dates serialize to ISO strings; `writable`
 * mirrors the writer role. Members+ only — guests get 401/403.
 * Entry `body` stays server-side — the mobile list never renders it.
 */
export async function GET() {
  const result = await listContentEntries();
  if (result.error !== undefined) {
    return writerErrorResponse(result.error);
  }
  return NextResponse.json({
    entries: result.entries.map((entry) => ({
      createdAt: entry.createdAt.toISOString(),
      excerpt: entry.excerpt,
      id: entry.id,
      locale: entry.locale,
      publishedAt: entry.publishedAt === null ? null : entry.publishedAt.toISOString(),
      requiredEntitlement: entry.requiredEntitlement,
      slug: entry.slug,
      status: entry.status,
      title: entry.title,
      type: entry.type,
      updatedAt: entry.updatedAt.toISOString(),
    })),
    writable: result.writable,
  });
}

/**
 * `POST /api/mobile/content` — creates a draft entry. Body:
 * `{type?, title?, slug?, body?, excerpt?, locale?, requiredEntitlement?}`
 * (all strings; the shared normalizer requires a safe `type` and a
 * `title`, and derives `slug` from the title when blank). 201 →
 * `{entryId}`; validation/duplicate-slug failures → 422 `{error}`.
 */
export async function POST(request: Request) {
  const writer = await requireWorkspaceWriter();
  if ("error" in writer) {
    return writerErrorResponse(writer.error);
  }
  let body: Record<string, unknown>;
  try {
    const value: unknown = await readBoundedJson(request, MAX_CONTENT_BODY_BYTES);
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
    }
    body = value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "The request body is too large." }, { status: 413 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
    }
    throw error;
  }
  const text = (key: string): string => {
    const value = body[key];
    return typeof value === "string" ? value : "";
  };
  const result = await createContentEntryAction({
    body: text("body"),
    excerpt: text("excerpt"),
    locale: text("locale"),
    requiredEntitlement: text("requiredEntitlement"),
    slug: text("slug"),
    title: text("title"),
    type: text("type"),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ entryId: result.entryId }, { status: 201 });
}
