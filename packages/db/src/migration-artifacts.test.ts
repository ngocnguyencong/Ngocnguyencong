import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const packageDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDirectory = join(packageDirectory, "drizzle");
const metadataDirectory = join(migrationsDirectory, "meta");

type JournalEntry = { idx: number; tag: string };

function readJournalEntries(): JournalEntry[] {
  const journal = JSON.parse(readFileSync(join(metadataDirectory, "_journal.json"), "utf8")) as {
    entries: JournalEntry[];
  };
  return journal.entries;
}

function readAllMigrationSql(): string {
  return readJournalEntries()
    .map((entry) => readFileSync(join(migrationsDirectory, `${entry.tag}.sql`), "utf8"))
    .join("\n");
}

describe("generated Drizzle migration artifacts", () => {
  it("keeps the baseline migration synchronized with the schema", () => {
    const entries = readJournalEntries();

    expect(entries.length).toBeGreaterThan(0);
    expect(entries.map((entry) => entry.idx)).toEqual(entries.map((_entry, index) => index));

    for (const entry of entries) {
      expect(existsSync(join(migrationsDirectory, `${entry.tag}.sql`))).toBe(true);
      expect(
        existsSync(join(metadataDirectory, `${String(entry.idx).padStart(4, "0")}_snapshot.json`)),
      ).toBe(true);
    }

    const allSql = readAllMigrationSql();

    for (const table of [
      "billing_customer",
      "billing_subscription",
      "provider_credential",
      "workspace_ai_policy",
      "ai_budget_reservation",
      "workspace_invitation",
      "passkey",
      "two_factor",
      "user_workspace_preference",
      "stored_object",
      "notification",
      "notification_preference",
      "chat_thread",
      "chat_message",
      "transactional_email_delivery",
      "webhook_event",
      "content_entry",
      "commerce_product",
      "commerce_order",
      "commerce_order_item",
      "feature_request",
      "feature_request_vote",
      "waitlist_entry",
      "early_access_code",
      "referral",
      "connected_account",
      "usage_counter",
      "job_schedule",
    ]) {
      expect(allSql).toContain(`CREATE TABLE "${table}"`);
    }

    for (const index of [
      "idx_billing_customer_provider_id",
      "idx_billing_subscription_provider_id",
      "idx_provider_credential_workspace_provider",
      "idx_stored_object_workspace_key",
      "idx_connected_account_workspace_provider_external",
      "idx_job_schedule_workspace_type",
    ]) {
      expect(allSql).toContain(`CREATE UNIQUE INDEX "${index}"`);
    }

    // Partial indexes on job_schedule: the (workspace,type) unique index
    // excludes platform rows, and the hot claim query only walks enabled
    // rows — both WHERE clauses are load-bearing.
    expect(allSql).toContain(
      'CREATE UNIQUE INDEX "idx_job_schedule_workspace_type" ON "job_schedule" USING btree ("workspace_id","type") WHERE "workspace_id" IS NOT NULL',
    );
    expect(allSql).toContain(
      'CREATE INDEX "idx_job_schedule_next_run_at" ON "job_schedule" USING btree ("next_run_at") WHERE "enabled"',
    );
    expect(allSql).toContain(
      'CREATE INDEX "idx_waitlist_entry_created_at" ON "waitlist_entry" USING btree ("created_at")',
    );

    expect(allSql).toContain("notification_preference_user_id_workspace_id_pk");
    expect(allSql).toContain('"monthly_budget_microunits" bigint');
    expect(allSql).toContain('"reserved_microunits" bigint NOT NULL');
    expect(allSql).toContain('"workspace_id" text NOT NULL');

    const credentialTable = allSql.slice(
      allSql.indexOf('CREATE TABLE "provider_credential"'),
      allSql.indexOf('CREATE TABLE "provider_credential"') + 2000,
    );
    expect(credentialTable).not.toMatch(/api[_ ]?key|plaintext/i);

    // K5: job_schedule.workspace_id must stay NULL-able — platform-level
    // schedules (e.g. platform:rate-limit.prune) own no workspace. Guard
    // against a schema regen that puts NOT NULL back.
    expect(allSql).toContain(
      'ALTER TABLE "job_schedule" ALTER COLUMN "workspace_id" DROP NOT NULL',
    );

    expect(allSql).not.toMatch(/kit_order|kit_license/);
    expect(readdirSync(metadataDirectory)).toContain("_journal.json");
  });

  // Existing databases drifted three ways (no issuer column / column with
  // NULLs / column with values), so every statement must be idempotent.
  it("adds account.issuer idempotently with a Better Auth issuer backfill", () => {
    const allSql = readAllMigrationSql();

    expect(allSql).toContain('ADD COLUMN IF NOT EXISTS "issuer"');
    expect(allSql).toContain("'local:credential'");
    expect(allSql).toContain("'local:oauth:'");
    expect(allSql).toContain('ALTER COLUMN "issuer" SET NOT NULL');
    expect(allSql).toContain('DROP INDEX IF EXISTS "idx_account_provider_account"');
    expect(allSql).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "idx_account_issuer_account" ON "account"',
    );
  });
});
