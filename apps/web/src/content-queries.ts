import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { contentEntry } from "@supastack/db";

import { database } from "./auth-runtime";
import { applyContentAccess } from "./content-access";
import type { ContentEntryRow } from "./content-actions";
import type { EntitlementRecord } from "./entitlement-check";

/** A published entry as a public reader sees it — `locked` rows ship an empty body. */
export type PublishedContentEntry = ContentEntryRow & Readonly<{ locked: boolean }>;

/**
 * Server-only read boundary for product surfaces (public blog/report pages
 * render these). Takes an explicit workspaceId — published entries are
 * deliberately public metadata, so callers do not need a session. Ordered by
 * publish date. Callers resolve the viewer's entitlements themselves (e.g.
 * `listViewerEntitlements` from `./entitlements`) — this module is not an RPC
 * endpoint, so `viewerEntitlements` is trusted server input; it must never be
 * accepted from a client. Rows gated on an entitlement the viewer lacks come
 * back `locked: true` with `body` stripped to `""` — locked bodies never
 * reach the wire. Omitting `viewerEntitlements` treats every gated entry as
 * locked.
 */
export async function listPublishedContentEntries(input: {
  locale?: string;
  type?: string;
  viewerEntitlements?: readonly EntitlementRecord[];
  workspaceId: string;
}): Promise<readonly PublishedContentEntry[]> {
  if (typeof input.workspaceId !== "string" || input.workspaceId.length === 0) {
    return [];
  }
  const conditions = [
    eq(contentEntry.workspaceId, input.workspaceId),
    eq(contentEntry.status, "published"),
  ];
  if (typeof input.type === "string" && input.type.length > 0) {
    conditions.push(eq(contentEntry.type, input.type));
  }
  if (typeof input.locale === "string" && input.locale.length > 0) {
    conditions.push(eq(contentEntry.locale, input.locale));
  }
  const rows = await database
    .select({
      body: contentEntry.body,
      createdAt: contentEntry.createdAt,
      excerpt: contentEntry.excerpt,
      id: contentEntry.id,
      locale: contentEntry.locale,
      publishedAt: contentEntry.publishedAt,
      requiredEntitlement: contentEntry.requiredEntitlement,
      slug: contentEntry.slug,
      status: contentEntry.status,
      title: contentEntry.title,
      type: contentEntry.type,
      updatedAt: contentEntry.updatedAt,
    })
    .from(contentEntry)
    .where(and(...conditions))
    .orderBy(desc(contentEntry.publishedAt))
    .limit(500);
  // The WHERE clause already pins status="published"; the map narrows the
  // raw varchar type onto the ContentEntryStatus union.
  const entries: ContentEntryRow[] = rows.map((row) => ({ ...row, status: "published" }));
  return applyContentAccess(entries, input.viewerEntitlements ?? []);
}
