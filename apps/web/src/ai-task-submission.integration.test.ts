import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createPostgresDatabase, taskRun, workspace } from "@supastack/db";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { describe, expect, it } from "vitest";
import { createAiTaskSubmissionStore, readAiTaskSubmission } from "./ai-task-submission-store";

const databaseUrl = process.env.TEST_SUBMISSION_DATABASE_URL;
describe.skipIf(!databaseUrl)("Postgres submission concurrency", () => {
  it("reserves one immutable task under concurrent retries and preserves completed state", async () => {
    const lifecycle = createPostgresDatabase({ databaseUrl: databaseUrl! });
    const workspaceId = `submission_test_${randomUUID()}`;
    try {
      await migrate(lifecycle.database, {
        migrationsFolder: fileURLToPath(new URL("../../../packages/db/drizzle", import.meta.url)),
      });
      await lifecycle.database.insert(workspace).values({
        id: workspaceId,
        name: "Submission concurrency test",
        slug: workspaceId,
        type: "personal",
      });
      const reserve = createAiTaskSubmissionStore(lifecycle.database);
      const input = {
        id: `task_${randomUUID()}`,
        workspaceId,
        taskName: "ai.generate",
        status: "queued",
        input: {
          prompt: "test",
          requirements: { vision: true },
          completionEmailTo: "test@example.test",
        },
      };
      const results = await Promise.all(Array.from({ length: 8 }, () => reserve(input)));
      expect(results.every((result) => result?.id === input.id)).toBe(true);
      const rows = await lifecycle.database
        .select()
        .from(taskRun)
        .where(eq(taskRun.workspaceId, workspaceId));
      expect(rows).toHaveLength(1);
      expect(await reserve({ ...input, input: { ...input.input, prompt: "conflict" } })).toBeNull();
      expect(
        await readAiTaskSubmission(lifecycle.database, {
          taskId: input.id,
          workspaceId: "another-workspace",
        }),
      ).toBeNull();
      expect(
        await readAiTaskSubmission(lifecycle.database, { taskId: input.id, workspaceId }),
      ).toMatchObject({ input: input.input });
      await lifecycle.database
        .update(taskRun)
        .set({ status: "completed", result: { text: "saved" }, completedAt: new Date() })
        .where(eq(taskRun.id, input.id));
      expect(await reserve(input)).toMatchObject({
        status: "completed",
        result: { text: "saved" },
      });
    } finally {
      await lifecycle.database.delete(workspace).where(eq(workspace.id, workspaceId));
      await lifecycle.close();
    }
  });
});
