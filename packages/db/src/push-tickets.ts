import { asc, inArray, lt } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { pushTicket } from "./schema";
import type * as schema from "./schema";

type PushTicketDatabase = PostgresJsDatabase<typeof schema>;

/** Row shape — one Expo push ticket recorded at send time. */
export type PushTicket = typeof pushTicket.$inferSelect;

export interface PushTicketInput {
  /** Expo ticket id (`id` on an `ok` send ticket). */
  readonly id: string;
  /** Device push token the message targeted. */
  readonly token: string;
  /** Owning user when known — null for workspace fan-out rows. */
  readonly userId: string | null;
}

/**
 * Push tickets awaiting receipt reconciliation. Tickets record successful
 * sends; a scheduled job later asks Expo for receipts and deletes rows —
 * pruning `DeviceNotRegistered` tokens on the way. Recording is an
 * insert-or-ignore so a replayed send never duplicates a ticket.
 */
export interface PushTicketRepository {
  /** Inserts tickets; existing ids are ignored. Returns rows inserted. */
  record(tickets: readonly PushTicketInput[]): Promise<number>;
  /** Tickets created before `olderThan`, oldest first, up to `limit`. */
  listDue(olderThan: Date, limit: number): Promise<PushTicket[]>;
  /** Deletes rows by ticket id. Returns rows removed. */
  remove(ids: readonly string[]): Promise<number>;
  /** Deletes every ticket created before `date` (unreconciled leftovers). Returns rows removed. */
  removeOlderThan(date: Date): Promise<number>;
}

function requireTicket(input: PushTicketInput): void {
  if (
    typeof input?.id !== "string" ||
    input.id.trim().length === 0 ||
    typeof input?.token !== "string" ||
    input.token.trim().length === 0 ||
    (input.userId !== null && typeof input.userId !== "string")
  ) {
    throw new Error("A valid push ticket (id, token, userId|null) is required.");
  }
}

function requireDate(date: Date): void {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error("A valid date is required.");
  }
}

export function createDrizzlePushTicketRepository(
  database: PushTicketDatabase,
): PushTicketRepository {
  const repository: PushTicketRepository = {
    async listDue(olderThan, limit) {
      requireDate(olderThan);
      if (!Number.isInteger(limit) || limit < 1) {
        throw new Error("A positive integer limit is required.");
      }
      return await database
        .select()
        .from(pushTicket)
        .where(lt(pushTicket.createdAt, olderThan))
        .orderBy(asc(pushTicket.createdAt))
        .limit(limit);
    },

    async record(tickets) {
      for (const ticket of tickets) requireTicket(ticket);
      if (tickets.length === 0) return 0;
      const inserted = await database
        .insert(pushTicket)
        .values(tickets.map((ticket) => ({ ...ticket })))
        .onConflictDoNothing()
        .returning({ id: pushTicket.id });
      return inserted.length;
    },

    async remove(ids) {
      for (const id of ids) {
        if (typeof id !== "string" || id.trim().length === 0) {
          throw new Error("A valid ticket id list is required.");
        }
      }
      if (ids.length === 0) return 0;
      const removed = await database
        .delete(pushTicket)
        .where(inArray(pushTicket.id, [...ids]))
        .returning({ id: pushTicket.id });
      return removed.length;
    },

    async removeOlderThan(date) {
      requireDate(date);
      const removed = await database
        .delete(pushTicket)
        .where(lt(pushTicket.createdAt, date))
        .returning({ id: pushTicket.id });
      return removed.length;
    },
  };
  return Object.freeze(repository);
}
