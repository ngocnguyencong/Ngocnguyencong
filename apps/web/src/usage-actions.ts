"use server";

import {
  AUDIT_ACTIONS,
  canManageWorkspaceMembers,
  createDrizzleUsageCapRepository,
  normalizeWorkspaceRole,
  workspaceAiPolicy,
  workspaceMembership,
} from "@supastack/db";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { recordAuditEvent } from "./audit-runtime";
import { database, getAuthSession } from "./auth-runtime";
import { resolveActiveWorkspaceIdForSessionUser } from "./organization-actions";
import { parseAiBudgetMicrounits, parseUsageCapInput } from "./usage-input";
import { USAGE_METERS } from "./usage-meters";

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Session → active workspace → owner/admin membership, the same gate the
 * members/organization settings actions use. Redirects `forbidden` when the
 * caller can't manage workspace limits; returns the scope on success.
 */
async function requireUsageManager(): Promise<
  Readonly<{
    userId: string;
    workspaceId: string;
  }>
> {
  const session = await getAuthSession(await headers());
  if (session === null) {
    redirect("/auth");
  }
  const workspaceId = await resolveActiveWorkspaceIdForSessionUser(session.user.id);
  if (workspaceId === undefined) {
    redirect("/settings/usage?status=invalid");
  }
  const [membership] = await database
    .select({ role: workspaceMembership.role })
    .from(workspaceMembership)
    .where(
      and(
        eq(workspaceMembership.userId, session.user.id),
        eq(workspaceMembership.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (
    membership === undefined ||
    !canManageWorkspaceMembers(normalizeWorkspaceRole(membership.role))
  ) {
    redirect("/settings/usage?status=forbidden");
  }
  return { userId: session.user.id, workspaceId };
}

/**
 * Settings → Usage → AI spend: sets the workspace's monthly AI budget in
 * `workspace_ai_policy.monthly_budget_microunits` (`reset=1` restores the
 * default / BYOK-unlimited by writing NULL). The `keyMode` column is
 * preserved on update; a fresh policy row starts as `"platform"`.
 */
export async function setAiMonthlyBudgetAction(formData: FormData): Promise<void> {
  const { userId, workspaceId } = await requireUsageManager();

  const reset = formString(formData, "reset") === "1";
  const microunits = reset ? null : parseAiBudgetMicrounits(formString(formData, "budget"));
  if (microunits === null && !reset) {
    redirect("/settings/usage?status=invalid");
  }

  await database
    .insert(workspaceAiPolicy)
    .values({
      keyMode: "platform",
      monthlyBudgetMicrounits: microunits,
      workspaceId,
    })
    .onConflictDoUpdate({
      target: workspaceAiPolicy.workspaceId,
      set: { monthlyBudgetMicrounits: microunits, updatedAt: new Date() },
    });

  await recordAuditEvent({
    action: AUDIT_ACTIONS.workspaceAiBudgetUpdated,
    actorUserId: userId,
    metadata: {
      monthlyBudgetMicrounits: microunits === null ? null : microunits.toString(),
    },
    targetId: workspaceId,
    targetType: "workspace",
    workspaceId,
  });

  redirect("/settings/usage?status=budget-saved");
}

/**
 * Settings → Usage → meter caps: sets or clears the owner cap for a catalog
 * meter key in `workspace_usage_cap`. Caps below the plan allowance stop
 * usage at the cap without drawing prepaid credits.
 */
export async function setUsageCapAction(formData: FormData): Promise<void> {
  const { userId, workspaceId } = await requireUsageManager();

  const key = formString(formData, "key");
  if (!USAGE_METERS.some((meter) => meter.key === key)) {
    redirect("/settings/usage?status=invalid");
  }
  const parsed = parseUsageCapInput(formString(formData, "cap"), formString(formData, "clear"));
  if (parsed.kind === "invalid") {
    redirect("/settings/usage?status=invalid");
  }

  const caps = createDrizzleUsageCapRepository(database);
  if (parsed.kind === "clear") {
    await caps.clear(workspaceId, key);
  } else {
    await caps.set(workspaceId, key, parsed.cap);
  }

  await recordAuditEvent({
    action: AUDIT_ACTIONS.workspaceUsageCapUpdated,
    actorUserId: userId,
    metadata: { cap: parsed.kind === "set" ? parsed.cap : null, key },
    targetId: workspaceId,
    targetType: "workspace",
    workspaceId,
  });

  redirect(`/settings/usage?status=${parsed.kind === "clear" ? "cap-cleared" : "cap-saved"}`);
}
