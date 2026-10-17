import "server-only";

import {
  earlyAccessCode,
  referral,
  waitlistEntry,
  type PostgresDatabaseLifecycle,
} from "@supastack/db";
import { and, asc, desc, eq, gt, isNull, lte, ne, or, sql } from "drizzle-orm";

import type { GrowthStore } from "./early-access";

/**
 * Drizzle-backed `GrowthStore` over the platform-level growth tables. All
 * writes are conditional/idempotent: redeem only wins when unredeemed,
 * join only flips non-joined rows, and referral inserts rely on the unique
 * (kind, referred_*) indexes so retries cannot double-count.
 */
type GrowthDatabase = PostgresDatabaseLifecycle["database"];

export function createGrowthStore(database: GrowthDatabase): GrowthStore {
  return {
    async findEarlyAccessCode(code) {
      const row = await database.query.earlyAccessCode.findFirst({
        where: eq(earlyAccessCode.code, code),
      });
      return row ?? null;
    },

    async bindEarlyAccessCodeEmail({ id, email, now }) {
      const updated = await database
        .update(earlyAccessCode)
        .set({ email, updatedAt: now })
        .where(
          and(
            eq(earlyAccessCode.id, id),
            isNull(earlyAccessCode.redeemedAt),
            or(isNull(earlyAccessCode.expiresAt), gt(earlyAccessCode.expiresAt, now)),
            or(isNull(earlyAccessCode.email), eq(earlyAccessCode.email, email)),
          ),
        )
        .returning({ id: earlyAccessCode.id });
      return updated.length > 0;
    },

    async findWaitlistEntryByEmail(email) {
      const row = await database.query.waitlistEntry.findFirst({
        where: eq(waitlistEntry.email, email),
      });
      return row ?? null;
    },

    async findWaitlistEntryByReferralCode(code) {
      const row = await database.query.waitlistEntry.findFirst({
        where: eq(waitlistEntry.referralCode, code),
      });
      return row ?? null;
    },

    async findWaitlistEntryById(id) {
      const row = await database.query.waitlistEntry.findFirst({
        where: eq(waitlistEntry.id, id),
      });
      return row ?? null;
    },

    async createWaitlistEntry(row) {
      const inserted = await database
        .insert(waitlistEntry)
        .values(row)
        .onConflictDoNothing({ target: waitlistEntry.email })
        .returning({ id: waitlistEntry.id });
      return inserted.length > 0 ? "created" : "duplicate";
    },

    async countWaitlistPosition(createdAt) {
      const [row] = await database
        .select({ count: sql<number>`count(*)::int` })
        .from(waitlistEntry)
        .where(lte(waitlistEntry.createdAt, createdAt));
      return Number(row?.count ?? 0);
    },

    async listWaitlistEntries({ status, limit, order }) {
      const orderBy =
        order === "referral"
          ? [desc(waitlistEntry.referralCount), asc(waitlistEntry.createdAt)]
          : [asc(waitlistEntry.createdAt)];
      return database.query.waitlistEntry.findMany({
        where: status ? eq(waitlistEntry.status, status) : undefined,
        orderBy,
        limit,
      });
    },

    async createEarlyAccessCode(row) {
      await database.insert(earlyAccessCode).values(row);
    },

    async markWaitlistInvited({ id, now }) {
      const updated = await database
        .update(waitlistEntry)
        .set({ status: "invited", invitedAt: now, updatedAt: now })
        .where(and(eq(waitlistEntry.id, id), eq(waitlistEntry.status, "waiting")))
        .returning({ id: waitlistEntry.id });
      return updated.length > 0;
    },

    async deleteWaitlistEntry(id) {
      const deleted = await database
        .delete(waitlistEntry)
        .where(eq(waitlistEntry.id, id))
        .returning({ id: waitlistEntry.id });
      return deleted.length > 0;
    },

    async redeemEarlyAccessCode({ id, userId, now }) {
      const updated = await database
        .update(earlyAccessCode)
        .set({ redeemedByUserId: userId, redeemedAt: now, updatedAt: now })
        .where(and(eq(earlyAccessCode.id, id), isNull(earlyAccessCode.redeemedAt)))
        .returning({ id: earlyAccessCode.id });
      return updated.length > 0;
    },

    async markWaitlistJoined({ id, now }) {
      const updated = await database
        .update(waitlistEntry)
        .set({ status: "joined", joinedAt: now, updatedAt: now })
        .where(and(eq(waitlistEntry.id, id), ne(waitlistEntry.status, "joined")))
        .returning({ id: waitlistEntry.id });
      return updated.length > 0;
    },

    async recordReferral(row) {
      return database.transaction(async (tx) => {
        const inserted = await tx
          .insert(referral)
          .values(row)
          .onConflictDoNothing()
          .returning({ id: referral.id });
        if (inserted.length === 0) {
          return "duplicate";
        }
        if (row.referrerEntryId) {
          await tx
            .update(waitlistEntry)
            .set({
              referralCount: sql`${waitlistEntry.referralCount} + 1`,
              updatedAt: row.createdAt,
            })
            .where(eq(waitlistEntry.id, row.referrerEntryId));
        }
        return "created";
      });
    },
  };
}
