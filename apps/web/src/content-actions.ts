"use server";

import { randomUUID } from "node:crypto";

import { AUDIT_ACTIONS, contentEntry } from "@supastack/db";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "./audit-runtime";
import { database } from "./auth-runtime";
import { isUniqueViolation } from "./db-errors";
import {
  evaluateContentStatusChange,
  isContentEntryStatus,
  normalizeContentEntryInput,
  type ContentEntryStatus,
} from "./content";
import { requireWorkspaceWriter } from "./workspace-access";
import { tryEmitWorkspaceEvent } from "./webhook-delivery";

export interface ContentEntryRow {
  body: string;
  createdAt: Date;
  excerpt: string | null;
  id: string;
  locale: string | null;
  publishedAt: Date | null;
  /** Minimum subscription tier required to read the body; null = free. */
  requiredEntitlement: string | null;
  slug: string;
  status: ContentEntryStatus;
  title: string;
  type: string;
  updatedAt: Date;
}

const CONTENT_PAGE_PATH = "/content";

const CONTENT_ENTRY_PROJECTION = {
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
};

function toContentEntryRow(
  row: Omit<ContentEntryRow, "status"> & { status: string },
): ContentEntryRow {
  return { ...row, status: isContentEntryStatus(row.status) ? row.status : "draft" };
}

/** Entries for the active workspace, newest first. Guests (read-only) get an error. */
export async function listContentEntries(): Promise<{
  entries: ContentEntryRow[];
  error?: string;
  writable: boolean;
}> {
  const context = await requireWorkspaceWriter();
  if ("error" in context) {
    return { entries: [], error: context.error, writable: false };
  }
  const rows = await database
    .select(CONTENT_ENTRY_PROJECTION)
    .from(contentEntry)
    .where(eq(contentEntry.workspaceId, context.workspaceId))
    .orderBy(desc(contentEntry.updatedAt))
    .limit(500);
  return {
    entries: rows.map(toContentEntryRow),
    writable: true,
  };
}

/** One entry for the active workspace (body included). `entry: null` for unknown or cross-workspace ids; guests get an error. */
export async function getContentEntry(entryId: string): Promise<{
  entry: ContentEntryRow | null;
  error?: string;
}> {
  const context = await requireWorkspaceWriter();
  if ("error" in context) {
    return { entry: null, error: context.error };
  }
  const [row] = await database
    .select(CONTENT_ENTRY_PROJECTION)
    .from(contentEntry)
    .where(and(eq(contentEntry.id, entryId), eq(contentEntry.workspaceId, context.workspaceId)))
    .limit(1);
  return { entry: row === undefined ? null : toContentEntryRow(row) };
}

export type ContentActionResult = { error: string; ok: false } | { entryId: string; ok: true };

export async function createContentEntryAction(input: {
  body?: string;
  excerpt?: string;
  locale?: string;
  requiredEntitlement?: string;
  slug?: string;
  title?: string;
  type?: string;
}): Promise<ContentActionResult> {
  const context = await requireWorkspaceWriter();
  if ("error" in context) {
    return { error: context.error, ok: false };
  }
  const normalized = normalizeContentEntryInput(input);
  if ("error" in normalized) {
    return { error: normalized.error, ok: false };
  }
  const entryId = `con_${randomUUID()}`;
  const now = new Date();
  try {
    await database.insert(contentEntry).values({
      body: normalized.body,
      createdAt: now,
      createdBy: context.userId,
      excerpt: normalized.excerpt,
      id: entryId,
      locale: normalized.locale,
      publishedAt: null,
      requiredEntitlement: normalized.requiredEntitlement,
      slug: normalized.slug,
      status: "draft",
      title: normalized.title,
      type: normalized.type,
      updatedAt: now,
      workspaceId: context.workspaceId,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        error: `A ${normalized.type} entry with slug "${normalized.slug}" already exists.`,
        ok: false,
      };
    }
    throw error;
  }
  await recordAuditEvent({
    action: AUDIT_ACTIONS.contentEntryCreated,
    actorUserId: context.userId,
    metadata: { slug: normalized.slug, type: normalized.type },
    targetId: entryId,
    targetType: "content_entry",
    workspaceId: context.workspaceId,
  });
  revalidatePath(CONTENT_PAGE_PATH);
  return { entryId, ok: true };
}

export async function updateContentEntryAction(
  input: {
    body?: string;
    excerpt?: string;
    locale?: string;
    requiredEntitlement?: string;
    slug?: string;
    title?: string;
    type?: string;
  } & { entryId: string },
): Promise<ContentActionResult> {
  const context = await requireWorkspaceWriter();
  if ("error" in context) {
    return { error: context.error, ok: false };
  }
  const normalized = normalizeContentEntryInput(input);
  if ("error" in normalized) {
    return { error: normalized.error, ok: false };
  }
  try {
    const updated = await database
      .update(contentEntry)
      .set({
        body: normalized.body,
        excerpt: normalized.excerpt,
        locale: normalized.locale,
        requiredEntitlement: normalized.requiredEntitlement,
        slug: normalized.slug,
        title: normalized.title,
        type: normalized.type,
        updatedAt: new Date(),
      })
      .where(
        and(eq(contentEntry.id, input.entryId), eq(contentEntry.workspaceId, context.workspaceId)),
      )
      .returning({ id: contentEntry.id });
    if (updated.length === 0) {
      return { error: "Content entry not found.", ok: false };
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        error: `A ${normalized.type} entry with slug "${normalized.slug}" already exists.`,
        ok: false,
      };
    }
    throw error;
  }
  revalidatePath(CONTENT_PAGE_PATH);
  return { entryId: input.entryId, ok: true };
}

/** Form action — moves an entry between draft / published / archived. */
export async function setContentEntryStatusAction(formData: FormData): Promise<void> {
  const context = await requireWorkspaceWriter();
  if ("error" in context) {
    revalidatePath(CONTENT_PAGE_PATH);
    return;
  }
  const entryId = formData.get("entryId");
  const next = formData.get("status");
  if (typeof entryId !== "string" || typeof next !== "string") {
    return;
  }
  const [current] = await database
    .select({ publishedAt: contentEntry.publishedAt, status: contentEntry.status })
    .from(contentEntry)
    .where(and(eq(contentEntry.id, entryId), eq(contentEntry.workspaceId, context.workspaceId)))
    .limit(1);
  if (current === undefined) {
    return;
  }
  const decision = evaluateContentStatusChange(current, next, new Date());
  if (!decision.ok) {
    revalidatePath(CONTENT_PAGE_PATH);
    return;
  }
  await database
    .update(contentEntry)
    .set({ publishedAt: decision.publishedAt, status: decision.status, updatedAt: new Date() })
    .where(and(eq(contentEntry.id, entryId), eq(contentEntry.workspaceId, context.workspaceId)));
  await recordAuditEvent({
    action: AUDIT_ACTIONS.contentEntryStatusChanged,
    actorUserId: context.userId,
    metadata: { from: current.status, to: decision.status },
    targetId: entryId,
    targetType: "content_entry",
    workspaceId: context.workspaceId,
  });
  if (decision.status === "published") {
    await tryEmitWorkspaceEvent({
      data: { entryId, status: decision.status },
      eventType: "content.published",
      workspaceId: context.workspaceId,
    });
  }
  revalidatePath(CONTENT_PAGE_PATH);
}

export async function deleteContentEntryAction(formData: FormData): Promise<void> {
  const context = await requireWorkspaceWriter();
  if ("error" in context) {
    revalidatePath(CONTENT_PAGE_PATH);
    return;
  }
  const entryId = formData.get("entryId");
  if (typeof entryId !== "string" || entryId.length === 0) {
    return;
  }
  await database
    .delete(contentEntry)
    .where(and(eq(contentEntry.id, entryId), eq(contentEntry.workspaceId, context.workspaceId)));
  await recordAuditEvent({
    action: AUDIT_ACTIONS.contentEntryDeleted,
    actorUserId: context.userId,
    targetId: entryId,
    targetType: "content_entry",
    workspaceId: context.workspaceId,
  });
  revalidatePath(CONTENT_PAGE_PATH);
}
