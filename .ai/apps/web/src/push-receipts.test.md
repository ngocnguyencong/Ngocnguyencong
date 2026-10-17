# apps/web/src/push-receipts.test.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Unit tests for `reconcilePushReceipts` with a fake `fetch` and fake
ticket/token repositories — no Expo network, no database.

## What It Does

- Covers: due-ticket window + 1000 cap passed to `listDue`; receipt ids
  chunked at `EXPO_RECEIPT_CHUNK_SIZE` (301 tickets → two POSTs);
  `DeviceNotRegistered` receipts pruning tokens once each; non-device
  errors (`MessageRateExceeded`) leaving tokens; ok + non-device-error
  receipts still deleting their tickets; tickets whose chunks never
  answer swept by `removeOlderThan` at the 24h cutoff; chunk failure
  isolation (a rejected POST increments `failedChunks`, later chunks
  still run, logger receives a token-free context); `Authorization:
  Bearer` when `accessToken` is provided and absent otherwise; malformed
  receipt payloads counted as chunk failures.
- `createDependencies()` builds the fake repos + a queueable fake fetch;
  `pushTicketRow` makes table-shaped rows.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for Expo push receipt reconciliation (WP6) | Devin |
