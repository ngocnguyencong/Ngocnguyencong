import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/pg-proxy";
import type { PostgresDatabaseLifecycle } from "@supastack/db";
import { createAiTaskSubmissionStore } from "./ai-task-submission-store";

const input = {
  id: "task_1",
  workspaceId: "workspace-a",
  taskName: "ai.generate",
  status: "queued",
  input: { prompt: "hello", requirements: { vision: true } },
};

describe("durable submission SQL", () => {
  it("uses conflict-safe insert before matching immutable workspace/request data", async () => {
    const queries: { sql: string; params: unknown[] }[] = [];
    const database = drizzle(async (sql, params) => {
      queries.push({ sql, params });
      return {
        rows: queries.length === 1 ? [] : [[null, "task_1", null, "queued", "workspace-a"]],
      };
    });
    const reserve = createAiTaskSubmissionStore(
      database as unknown as PostgresDatabaseLifecycle["database"],
    );
    expect(await reserve(input)).toMatchObject({
      id: "task_1",
      status: "queued",
      workspaceId: "workspace-a",
    });
    expect(queries[0]?.sql).toContain('on conflict ("id") do nothing');
    expect(queries[1]?.sql).toContain('"task_run"."workspace_id" =');
    expect(queries[1]?.sql).toContain('"task_run"."input" =');
    expect(queries[1]?.sql).toContain("::jsonb");
    expect(queries[1]?.params).toEqual([
      "task_1",
      "workspace-a",
      "ai.generate",
      JSON.stringify(input.input),
      1,
    ]);
  });

  it("returns null when a conflicting row does not match immutable data", async () => {
    const database = drizzle(async () => ({ rows: [] }));
    const reserve = createAiTaskSubmissionStore(
      database as unknown as PostgresDatabaseLifecycle["database"],
    );
    expect(await reserve(input)).toBeNull();
  });
});
