# packages/db/src/push-tickets.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

`PushTicketRepository` for the `push_ticket` table — Expo send tickets
recorded at push time so `push-receipts.ts` can ask Expo for delivery
receipts later.

## What It Does

- `record(tickets)` — insert-or-ignore (`onConflictDoNothing`) so a
  replayed send never duplicates a ticket id; returns rows inserted.
- `listDue(olderThan, limit)` — tickets created before the cutoff,
  oldest first, bounded by `limit`.
- `remove(ids)` — one `inArray` delete by ticket id; returns rows
  removed.
- `removeOlderThan(date)` — sweeps unreconciled leftovers; returns rows
  removed.
- Input validation matches `push-tokens.ts`: non-empty id/token,
  `userId` string-or-null, finite dates, positive-integer limit; empty
  batches short-circuit before touching the database.

## Dependencies

- `pushTicket` schema table (`id` PK = Expo ticket id, `token`,
  nullable `userId` → `user` cascade, `createdAt` +
  `idx_push_ticket_created_at`).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for Expo push receipt reconciliation (WP6) | Devin |
