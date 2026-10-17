import "server-only";

import { randomUUID } from "node:crypto";

import {
  auditEvent,
  createAuditEventRecord,
  describeAuditEvent,
  user,
  type AuditEventRecordInput,
} from "@supastack/db";
import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";

import { database } from "./auth-runtime";
import { requireWorkspaceManager } from "./workspace-access";

/**
 * Append-only audit sink. Recording is best-effort: a failure is logged and
 * never blocks the product action that produced the event.
 */
export async function recordAuditEvent(input: AuditEventRecordInput): Promise<void> {
  try {
    const headerList = await headers();
    const forwarded = headerList.get("x-forwarded-for");
    const ipAddress = input.ipAddress ?? forwarded?.split(",")[0]?.trim() ?? null;
    const record = createAuditEventRecord(
      { createId: () => `audit_${randomUUID()}`, now: () => new Date() },
      { ...input, ipAddress },
    );
    await database.insert(auditEvent).values(record);
  } catch (error) {
    console.error("[audit] failed to record event", {
      action: input.action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Audit sink for non-request contexts (scheduler sweeps, background jobs):
 * same record shape as `recordAuditEvent` without reading request headers —
 * `headers()` would throw outside a request scope and silently drop the event.
 */
export async function recordSystemAuditEvent(input: AuditEventRecordInput): Promise<void> {
  try {
    const record = createAuditEventRecord(
      { createId: () => `audit_${randomUUID()}`, now: () => new Date() },
      input,
    );
    await database.insert(auditEvent).values(record);
  } catch (error) {
    console.error("[audit] failed to record event", {
      action: input.action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export interface WorkspaceAuditRow {
  action: string;
  actorEmail: string | null;
  createdAt: Date;
  id: string;
  label: string;
  targetType: string | null;
}

/** Recent audit events for the active workspace; owner/admin only. */
export async function listWorkspaceAuditEvents(limit = 100): Promise<{
  error?: string;
  rows: WorkspaceAuditRow[];
}> {
  const context = await requireWorkspaceManager();
  if ("error" in context) {
    return { error: context.error, rows: [] };
  }
  const rows = await database
    .select({
      action: auditEvent.action,
      actorEmail: user.email,
      createdAt: auditEvent.createdAt,
      id: auditEvent.id,
      targetType: auditEvent.targetType,
    })
    .from(auditEvent)
    .leftJoin(user, eq(user.id, auditEvent.actorUserId))
    .where(eq(auditEvent.workspaceId, context.workspaceId))
    .orderBy(desc(auditEvent.createdAt))
    .limit(Math.min(Math.max(limit, 1), 500));
  return {
    rows: rows.map((row) => ({
      ...row,
      label: describeAuditEvent(row),
    })),
  };
}
