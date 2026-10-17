import "server-only";

import {
  aiUsage,
  billingSubscription,
  chatThread,
  notification,
  taskRun,
  workspace,
  workspaceInvitation,
  workspaceMembership,
} from "@supastack/db";
import { and, count, desc, eq, gte, isNull } from "drizzle-orm";

import { database } from "./auth-runtime";
import type { ChatScope } from "./chat-api";

export type WorkspaceMetrics = Readonly<{
  aiSpendMicrounitsThisMonth: string;
  aiTasksThisMonth: number;
  chatThreads: number;
  memberCount: number;
  pendingInvitations: number;
  plan: Readonly<{ priceReference: string; status: string }> | null;
  unreadNotifications: number;
  workspaceName: string;
  workspaceType: string;
}>;

/**
 * Aggregates dashboard metrics strictly inside the caller's workspace scope.
 * Counts come straight from existing tables — nothing is estimated or sampled.
 */
export async function loadWorkspaceMetrics(scope: ChatScope): Promise<WorkspaceMetrics> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [workspaceRow, members, invites, unread, threads, tasks, usageRows, latestSubscription] =
    await Promise.all([
      database
        .select({ name: workspace.name, type: workspace.type })
        .from(workspace)
        .where(eq(workspace.id, scope.workspaceId))
        .limit(1),
      database
        .select({ value: count() })
        .from(workspaceMembership)
        .where(eq(workspaceMembership.workspaceId, scope.workspaceId)),
      database
        .select({ value: count() })
        .from(workspaceInvitation)
        .where(
          and(
            eq(workspaceInvitation.workspaceId, scope.workspaceId),
            eq(workspaceInvitation.status, "pending"),
          ),
        ),
      database
        .select({ value: count() })
        .from(notification)
        .where(
          and(
            eq(notification.workspaceId, scope.workspaceId),
            eq(notification.userId, scope.userId),
            isNull(notification.readAt),
          ),
        ),
      database
        .select({ value: count() })
        .from(chatThread)
        .where(
          and(eq(chatThread.workspaceId, scope.workspaceId), eq(chatThread.userId, scope.userId)),
        ),
      database
        .select({ value: count() })
        .from(taskRun)
        .where(and(eq(taskRun.workspaceId, scope.workspaceId), gte(taskRun.createdAt, monthStart))),
      database
        .select({ costMicrounits: aiUsage.costMicrounits })
        .from(aiUsage)
        .where(and(eq(aiUsage.workspaceId, scope.workspaceId), gte(aiUsage.createdAt, monthStart))),
      database
        .select({
          priceReference: billingSubscription.priceReference,
          status: billingSubscription.status,
        })
        .from(billingSubscription)
        .where(eq(billingSubscription.workspaceId, scope.workspaceId))
        .orderBy(desc(billingSubscription.createdAt))
        .limit(1),
    ]);

  const aiSpend = usageRows.reduce((total, row) => total + row.costMicrounits, 0n);

  return {
    aiSpendMicrounitsThisMonth: aiSpend.toString(),
    aiTasksThisMonth: tasks[0]?.value ?? 0,
    chatThreads: threads[0]?.value ?? 0,
    memberCount: members[0]?.value ?? 0,
    pendingInvitations: invites[0]?.value ?? 0,
    plan: latestSubscription[0] ?? null,
    unreadNotifications: unread[0]?.value ?? 0,
    workspaceName: workspaceRow[0]?.name ?? "Workspace",
    workspaceType: workspaceRow[0]?.type ?? "personal",
  };
}
