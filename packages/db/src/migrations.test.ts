import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { MIGRATION_JOURNAL_ENTRIES } from "./migration-journal";
import { listPendingMigrations } from "./migrations";

const here = dirname(fileURLToPath(import.meta.url));

function journalEntries(): readonly { tag: string; when: number }[] {
  const journal = JSON.parse(
    readFileSync(join(here, "..", "drizzle", "meta", "_journal.json"), "utf8"),
  );
  return journal.entries;
}

function executor(rows: readonly { createdAt: unknown }[] | Error) {
  return {
    execute: async () => {
      if (rows instanceof Error) {
        throw rows;
      }
      return [...rows];
    },
  };
}

describe("MIGRATION_JOURNAL_ENTRIES", () => {
  it("mirrors every drizzle/meta/_journal.json tag + timestamp", () => {
    expect(MIGRATION_JOURNAL_ENTRIES).toEqual(
      journalEntries().map((entry) => ({ tag: entry.tag, when: entry.when })),
    );
  });
});

describe("listPendingMigrations", () => {
  it("treats a missing migrations table as everything pending", async () => {
    const missing = Object.assign(
      new Error('relation "drizzle.__drizzle_migrations" does not exist'),
      { code: "42P01" },
    );
    const pending = await listPendingMigrations(executor(missing));
    expect(pending).toEqual(journalEntries().map((entry) => entry.tag));
  });

  it("rethrows read errors that are not a missing table", async () => {
    const failure = Object.assign(new Error("permission denied"), { code: "42501" });
    await expect(listPendingMigrations(executor(failure))).rejects.toThrow("permission denied");
  });

  it("returns only the journal tags not yet recorded", async () => {
    const entries = journalEntries();
    const applied = entries.slice(0, entries.length - 2);
    const pending = await listPendingMigrations(
      executor(applied.map((entry) => ({ createdAt: String(entry.when) }))),
    );
    expect(pending).toEqual(entries.slice(-2).map((entry) => entry.tag));
  });

  it("returns empty when every migration is applied", async () => {
    const pending = await listPendingMigrations(
      executor(journalEntries().map((entry) => ({ createdAt: entry.when }))),
    );
    expect(pending).toEqual([]);
  });
});
