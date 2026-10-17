"use server";

import { randomUUID } from "node:crypto";

import { announcement, announcementDismissal } from "@supastack/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";

import { database, getAuthSession } from "./auth-runtime";
import { isAnnouncementActive } from "./feature-flags";

export interface ActiveAnnouncement {
  body: string;
  id: string;
  severity: "critical" | "info" | "warning";
  title: string;
}

/** Announcements currently inside their window and not dismissed by the user. */
export async function listActiveAnnouncements(): Promise<ActiveAnnouncement[]> {
  const session = await getAuthSession(await headers());
  if (session === null) {
    return [];
  }
  const rows = await database
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
    .limit(50);
  const now = new Date();
  const active = rows.filter((row) => isAnnouncementActive(row, now));
  if (active.length === 0) {
    return [];
  }
  const dismissed = await database
    .select({ announcementId: announcementDismissal.announcementId })
    .from(announcementDismissal)
    .where(
      and(
        eq(announcementDismissal.userId, session.user.id),
        inArray(
          announcementDismissal.announcementId,
          active.map((row) => row.id),
        ),
      ),
    );
  const dismissedIds = new Set(dismissed.map((row) => row.announcementId));
  return active
    .filter((row) => !dismissedIds.has(row.id))
    .map((row) => ({
      body: row.body,
      id: row.id,
      severity: row.severity === "critical" || row.severity === "warning" ? row.severity : "info",
      title: row.title,
    }));
}

export async function dismissAnnouncementAction(formData: FormData): Promise<void> {
  const session = await getAuthSession(await headers());
  if (session === null) {
    return;
  }
  const announcementId = formData.get("announcementId");
  if (typeof announcementId !== "string" || announcementId.length === 0) {
    return;
  }
  await database
    .insert(announcementDismissal)
    .values({
      announcementId,
      createdAt: new Date(),
      id: `and_${randomUUID()}`,
      userId: session.user.id,
    })
    .onConflictDoNothing({
      target: [announcementDismissal.announcementId, announcementDismissal.userId],
    });
}
