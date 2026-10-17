"use server";

import { randomUUID } from "node:crypto";

import { announcement, featureFlag, featureFlagOverride } from "@supastack/db";
import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { requireAdminSession } from "./admin-actions";
import { database } from "./auth-runtime";
import { isValidFlagKey, normalizeAnnouncementSeverity } from "./feature-flags";

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export interface FeatureFlagRow {
  defaultEnabled: boolean;
  description: string | null;
  id: string;
  key: string;
  overrideCount: number;
}

export async function listFeatureFlags(): Promise<FeatureFlagRow[]> {
  await requireAdminSession();
  const flags = await database
    .select({
      defaultEnabled: featureFlag.enabled,
      description: featureFlag.description,
      id: featureFlag.id,
      key: featureFlag.key,
    })
    .from(featureFlag)
    .orderBy(featureFlag.key);
  const overrides = await database
    .select({ flagId: featureFlagOverride.flagId })
    .from(featureFlagOverride);
  const counts = new Map<string, number>();
  for (const row of overrides) {
    counts.set(row.flagId, (counts.get(row.flagId) ?? 0) + 1);
  }
  return flags.map((flag) => ({ ...flag, overrideCount: counts.get(flag.id) ?? 0 }));
}

export async function upsertFeatureFlagAction(formData: FormData): Promise<void> {
  await requireAdminSession();
  const key = formString(formData, "key");
  const description = formString(formData, "description") || null;
  const enabled = formData.get("enabled") === "on";
  if (!isValidFlagKey(key)) {
    redirect("/admin/flags?status=invalid-key");
  }
  const now = new Date();
  await database
    .insert(featureFlag)
    .values({
      createdAt: now,
      description,
      enabled,
      id: `flag_${randomUUID()}`,
      key,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      set: { description, enabled, updatedAt: now },
      target: featureFlag.key,
    });
  redirect("/admin/flags?status=saved");
}

export async function deleteFeatureFlagAction(formData: FormData): Promise<void> {
  await requireAdminSession();
  const flagId = formString(formData, "flagId");
  if (flagId.length === 0) {
    redirect("/admin/flags?status=invalid");
  }
  await database.delete(featureFlag).where(eq(featureFlag.id, flagId));
  redirect("/admin/flags?status=deleted");
}

export async function setFeatureFlagOverrideAction(formData: FormData): Promise<void> {
  await requireAdminSession();
  const flagId = formString(formData, "flagId");
  const scopeType = formString(formData, "scopeType");
  const scopeId = formString(formData, "scopeId");
  const state = formString(formData, "state");
  if (
    flagId.length === 0 ||
    scopeId.length === 0 ||
    (scopeType !== "workspace" && scopeType !== "user") ||
    (state !== "on" && state !== "off" && state !== "clear")
  ) {
    redirect("/admin/flags?status=invalid");
  }
  if (state === "clear") {
    await database
      .delete(featureFlagOverride)
      .where(
        and(
          eq(featureFlagOverride.flagId, flagId),
          eq(featureFlagOverride.scopeType, scopeType),
          eq(featureFlagOverride.scopeId, scopeId),
        ),
      );
    redirect("/admin/flags?status=cleared");
  }
  const now = new Date();
  await database
    .insert(featureFlagOverride)
    .values({
      createdAt: now,
      enabled: state === "on",
      flagId,
      id: `ffo_${randomUUID()}`,
      scopeId,
      scopeType,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      set: { enabled: state === "on", updatedAt: now },
      target: [
        featureFlagOverride.flagId,
        featureFlagOverride.scopeType,
        featureFlagOverride.scopeId,
      ],
    });
  redirect("/admin/flags?status=override-saved");
}

export interface AnnouncementRow {
  body: string;
  endsAt: Date | null;
  id: string;
  severity: string;
  startsAt: Date;
  title: string;
}

export async function listAnnouncements(): Promise<AnnouncementRow[]> {
  await requireAdminSession();
  return database
    .select({
      body: announcement.body,
      endsAt: announcement.endsAt,
      id: announcement.id,
      severity: announcement.severity,
      startsAt: announcement.startsAt,
      title: announcement.title,
    })
    .from(announcement)
    .orderBy(desc(announcement.startsAt))
    .limit(200);
}

export async function createAnnouncementAction(formData: FormData): Promise<void> {
  await requireAdminSession();
  const title = formString(formData, "title");
  const body = formString(formData, "body");
  const severity = normalizeAnnouncementSeverity(formString(formData, "severity"));
  const startsAtRaw = formString(formData, "startsAt");
  const endsAtRaw = formString(formData, "endsAt");
  const startsAt = startsAtRaw ? new Date(startsAtRaw) : new Date();
  const endsAt = endsAtRaw ? new Date(endsAtRaw) : null;
  if (title.length === 0 || body.length === 0 || Number.isNaN(startsAt.getTime())) {
    redirect("/admin/announcements?status=invalid");
  }
  if (endsAt !== null && Number.isNaN(endsAt.getTime())) {
    redirect("/admin/announcements?status=invalid");
  }
  const now = new Date();
  await database.insert(announcement).values({
    body,
    createdAt: now,
    endsAt,
    id: `ann_${randomUUID()}`,
    severity,
    startsAt,
    title,
    updatedAt: now,
  });
  redirect("/admin/announcements?status=created");
}

export async function deleteAnnouncementAction(formData: FormData): Promise<void> {
  await requireAdminSession();
  const announcementId = formString(formData, "announcementId");
  if (announcementId.length === 0) {
    redirect("/admin/announcements?status=invalid");
  }
  await database.delete(announcement).where(eq(announcement.id, announcementId));
  redirect("/admin/announcements?status=deleted");
}
