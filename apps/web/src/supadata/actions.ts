"use server";

import { sdAlert, sdFunnel, sdGoal, sdSite, sdSiteKey } from "@supastack/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { database } from "../auth-runtime";
import { requireWorkspaceWriter } from "../workspace-access";
import { sdId, sdShareId, sdSiteId, newSiteKey } from "./id";

export type ActionResult =
  { ok: true; id?: string | undefined; key?: string | undefined } | { ok: false; error: string };

async function siteOwned(siteId: string): Promise<{ workspaceId: string } | { error: string }> {
  const ctx = await requireWorkspaceWriter();
  if ("error" in ctx) return { error: ctx.error };
  const [site] = await database
    .select({ workspaceId: sdSite.workspaceId })
    .from(sdSite)
    .where(eq(sdSite.id, siteId))
    .limit(1);
  if (!site || site.workspaceId !== ctx.workspaceId) return { error: "Site not found." };
  return { workspaceId: ctx.workspaceId };
}

const siteSchema = z.object({
  domain: z.string().min(1).max(255),
  name: z.string().max(255).optional(),
});

export async function createSiteAction(input: {
  domain: string;
  name?: string | undefined;
}): Promise<ActionResult> {
  const ctx = await requireWorkspaceWriter();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const parsed = siteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid domain." };
  const id = sdSiteId();
  const domain = parsed.data.domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  await database.insert(sdSite).values({
    id,
    workspaceId: ctx.workspaceId,
    domain,
    name: parsed.data.name || domain,
    shareId: sdShareId(),
  });
  const key = newSiteKey();
  await database
    .insert(sdSiteKey)
    .values({ id: sdId(), siteId: id, name: "default", prefix: key.prefix, keyHash: key.hash });
  revalidatePath("/dashboard");
  return { ok: true, id, key: key.key };
}

const updateSiteSchema = z.object({
  name: z.string().max(255).optional(),
  timezone: z.string().max(64).optional(),
  allowedHostnames: z.string().max(2048).optional(),
  cookieless: z.boolean().optional(),
});

export async function updateSiteAction(
  siteId: string,
  input: z.infer<typeof updateSiteSchema>,
): Promise<ActionResult> {
  const owned = await siteOwned(siteId);
  if ("error" in owned) return { ok: false, error: owned.error };
  const parsed = updateSiteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  await database.update(sdSite).set(parsed.data).where(eq(sdSite.id, siteId));
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function regenerateShareLinkAction(siteId: string): Promise<ActionResult> {
  const owned = await siteOwned(siteId);
  if ("error" in owned) return { ok: false, error: owned.error };
  const shareId = sdShareId();
  await database.update(sdSite).set({ shareId }).where(eq(sdSite.id, siteId));
  return { ok: true, id: shareId };
}

export async function createSiteKeyAction(siteId: string, name: string): Promise<ActionResult> {
  const owned = await siteOwned(siteId);
  if ("error" in owned) return { ok: false, error: owned.error };
  const key = newSiteKey();
  await database
    .insert(sdSiteKey)
    .values({ id: sdId(), siteId, name: name || "key", prefix: key.prefix, keyHash: key.hash });
  return { ok: true, key: key.key };
}

export async function revokeSiteKeyAction(siteId: string, keyId: string): Promise<ActionResult> {
  const owned = await siteOwned(siteId);
  if ("error" in owned) return { ok: false, error: owned.error };
  await database
    .update(sdSiteKey)
    .set({ revokedAt: new Date() })
    .where(and(eq(sdSiteKey.id, keyId), eq(sdSiteKey.siteId, siteId)));
  return { ok: true };
}

const goalSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(["pageview", "event"]),
  value: z.string().min(1).max(512),
});

export async function createGoalAction(
  siteId: string,
  input: z.infer<typeof goalSchema>,
): Promise<ActionResult> {
  const owned = await siteOwned(siteId);
  if ("error" in owned) return { ok: false, error: owned.error };
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid goal." };
  const [row] = await database
    .insert(sdGoal)
    .values({ id: sdId(), siteId, ...parsed.data })
    .returning({ id: sdGoal.id });
  return { ok: true, id: row?.id };
}

export async function deleteGoalAction(siteId: string, goalId: string): Promise<ActionResult> {
  const owned = await siteOwned(siteId);
  if ("error" in owned) return { ok: false, error: owned.error };
  await database.delete(sdGoal).where(and(eq(sdGoal.id, goalId), eq(sdGoal.siteId, siteId)));
  revalidatePath("/dashboard/goals");
  return { ok: true };
}

const funnelSchema = z.object({
  name: z.string().min(1).max(120),
  steps: z
    .array(z.object({ type: z.enum(["pageview", "event"]), value: z.string().min(1).max(512) }))
    .min(2)
    .max(8),
});

export async function createFunnelAction(
  siteId: string,
  input: z.infer<typeof funnelSchema>,
): Promise<ActionResult> {
  const owned = await siteOwned(siteId);
  if ("error" in owned) return { ok: false, error: owned.error };
  const parsed = funnelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "2–8 steps required." };
  const [row] = await database
    .insert(sdFunnel)
    .values({
      id: sdId(),
      siteId,
      name: parsed.data.name,
      steps: JSON.stringify(parsed.data.steps),
    })
    .returning({ id: sdFunnel.id });
  return { ok: true, id: row?.id };
}

export async function deleteFunnelAction(siteId: string, funnelId: string): Promise<ActionResult> {
  const owned = await siteOwned(siteId);
  if ("error" in owned) return { ok: false, error: owned.error };
  await database
    .delete(sdFunnel)
    .where(and(eq(sdFunnel.id, funnelId), eq(sdFunnel.siteId, siteId)));
  revalidatePath("/dashboard/funnels");
  return { ok: true };
}

const alertSchema = z.object({
  name: z.string().min(1).max(120),
  metric: z.enum(["visitors", "pageviews", "revenue", "signups", "goal", "mentions"]),
  condition: z.enum(["gt", "lt"]),
  threshold: z.coerce.number(),
  period: z.enum(["hour", "day"]).default("day"),
  target: z.string().max(255).optional(),
});

export async function createAlertAction(
  siteId: string,
  input: z.infer<typeof alertSchema>,
): Promise<ActionResult> {
  const owned = await siteOwned(siteId);
  if ("error" in owned) return { ok: false, error: owned.error };
  const parsed = alertSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid alert." };
  const [row] = await database
    .insert(sdAlert)
    .values({ id: sdId(), siteId, ...parsed.data })
    .returning({ id: sdAlert.id });
  return { ok: true, id: row?.id };
}

export async function toggleAlertAction(
  siteId: string,
  alertId: string,
  active: boolean,
): Promise<ActionResult> {
  const owned = await siteOwned(siteId);
  if ("error" in owned) return { ok: false, error: owned.error };
  await database
    .update(sdAlert)
    .set({ active })
    .where(and(eq(sdAlert.id, alertId), eq(sdAlert.siteId, siteId)));
  revalidatePath("/dashboard/alerts");
  return { ok: true };
}

export async function deleteAlertAction(siteId: string, alertId: string): Promise<ActionResult> {
  const owned = await siteOwned(siteId);
  if ("error" in owned) return { ok: false, error: owned.error };
  await database.delete(sdAlert).where(and(eq(sdAlert.id, alertId), eq(sdAlert.siteId, siteId)));
  revalidatePath("/dashboard/alerts");
  return { ok: true };
}
