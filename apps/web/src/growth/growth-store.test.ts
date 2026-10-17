import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import { earlyAccessCode } from "@supastack/db";

import { createGrowthStore } from "./growth-store";

vi.mock("server-only", () => ({}));

const NOW = new Date("2026-09-22T00:00:00.000Z");

describe("createGrowthStore invite binding", () => {
  it("uses one conditional update for the verified mailbox claim", async () => {
    const query = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn(async () => [{ id: "code1" }]),
    };
    const database = { update: vi.fn(() => query) };

    const claimed = await createGrowthStore(database as never).bindEarlyAccessCodeEmail({
      id: "code1",
      email: "alice@example.test",
      now: NOW,
    });

    expect(claimed).toBe(true);
    expect(database.update).toHaveBeenCalledWith(earlyAccessCode);
    expect(query.set).toHaveBeenCalledWith({ email: "alice@example.test", updatedAt: NOW });

    const where = query.where.mock.calls[0]?.[0];
    const { sql, params } = new PgDialect().sqlToQuery(where as never);
    const normalizedSql = sql.toLowerCase();
    expect(normalizedSql).toContain('"early_access_code"."redeemed_at" is null');
    expect(normalizedSql).toContain('"early_access_code"."expires_at" is null');
    expect(normalizedSql).toContain('"early_access_code"."expires_at" > $2');
    expect(normalizedSql).toContain('"early_access_code"."email" is null');
    expect(normalizedSql).toContain('"early_access_code"."email" = $3');
    expect(params).toEqual(["code1", NOW.toISOString(), "alice@example.test"]);
  });

  it("returns false when the conditional claim update loses", async () => {
    const query = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn(async () => [] as Array<{ id: string }>),
    };
    const store = createGrowthStore({ update: vi.fn(() => query) } as never);

    await expect(
      store.bindEarlyAccessCodeEmail({
        id: "code1",
        email: "bob@example.test",
        now: NOW,
      }),
    ).resolves.toBe(false);
  });
});
