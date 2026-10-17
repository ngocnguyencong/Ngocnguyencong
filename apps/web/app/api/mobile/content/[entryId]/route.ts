import { NextResponse } from "next/server";

import {
  deleteContentEntryAction,
  getContentEntry,
  setContentEntryStatusAction,
  updateContentEntryAction,
} from "../../../../../src/content-actions";
import { isContentEntryStatus } from "../../../../../src/content";
import { readBoundedJson, RequestBodyTooLargeError } from "../../../../../src/request-body";
import { requireWorkspaceWriter } from "../../../../../src/workspace-access";

export const runtime = "nodejs";

/** Entry bodies can carry long Markdown — 1 MiB matches the webhook cap. */
const MAX_CONTENT_BODY_BYTES = 1_048_576;

/** Fields forwarded verbatim to `updateContentEntryAction`. */
const ENTRY_FIELD_KEYS = [
  "body",
  "excerpt",
  "locale",
  "requiredEntitlement",
  "slug",
  "title",
  "type",
] as const;

function writerErrorResponse(error: string) {
  return NextResponse.json({ error }, { status: error === "Sign in required." ? 401 : 403 });
}

/**
 * `GET /api/mobile/content/:entryId` — one entry WITH its `body`, so the
 * mobile editor can prefill the full-form PATCH (which replaces omitted
 * fields). `getContentEntry` writer-gates and workspace-scopes identically
 * to the collection route and PATCH.
 */
export async function GET(_request: Request, context: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await context.params;
  const result = await getContentEntry(entryId);
  if (result.error !== undefined) {
    return writerErrorResponse(result.error);
  }
  const entry = result.entry;
  if (entry === null) {
    return NextResponse.json({ error: "Content entry not found." }, { status: 404 });
  }
  return NextResponse.json({
    entry: {
      body: entry.body,
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
    },
  });
}

/**
 * `PATCH /api/mobile/content/:entryId` — two composable operations:
 *
 * - Field update: any of `body`, `excerpt`, `locale`,
 *   `requiredEntitlement`, `slug`, `title`, `type` (strings) runs
 *   `updateContentEntryAction`. Semantics match the web editor —
 *   full-form replace, so `type`/`title` must be present (the shared
 *   normalizer requires them) and a blank `slug` re-derives from title.
 * - Lifecycle: `"status": "draft" | "published" | "archived"` runs
 *   `setContentEntryStatusAction`. Transitions are free in both
 *   directions; an unchanged status is a silent no-op server-side.
 *
 * Both may be sent together (fields update first, then status).
 * `{ok:false}` from the update → 422; an unknown status string → 400;
 * a body carrying neither → 400.
 */
export async function PATCH(request: Request, context: { params: Promise<{ entryId: string }> }) {
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
  const { entryId } = await context.params;

  const fields: Partial<Record<(typeof ENTRY_FIELD_KEYS)[number], string>> = {};
  for (const key of ENTRY_FIELD_KEYS) {
    const value = body[key];
    if (typeof value === "string") {
      fields[key] = value;
    }
  }
  const hasFieldUpdate = Object.keys(fields).length > 0;
  const status = body.status;
  if (!hasFieldUpdate && status === undefined) {
    return NextResponse.json(
      { error: "Provide entry fields or a status to update." },
      { status: 400 },
    );
  }
  if (status !== undefined && !isContentEntryStatus(status)) {
    return NextResponse.json(
      { error: "Status must be draft, published, or archived." },
      { status: 400 },
    );
  }
  if (hasFieldUpdate) {
    const result = await updateContentEntryAction({ entryId, ...fields });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }
  }
  if (status !== undefined) {
    const formData = new FormData();
    formData.set("entryId", entryId);
    formData.set("status", status);
    await setContentEntryStatusAction(formData);
  }
  return NextResponse.json({ ok: true });
}

/** `DELETE /api/mobile/content/:entryId` — removes the entry (member+). */
export async function DELETE(_request: Request, context: { params: Promise<{ entryId: string }> }) {
  const writer = await requireWorkspaceWriter();
  if ("error" in writer) {
    return writerErrorResponse(writer.error);
  }
  const { entryId } = await context.params;
  const formData = new FormData();
  formData.set("entryId", entryId);
  await deleteContentEntryAction(formData);
  return NextResponse.json({ ok: true });
}
