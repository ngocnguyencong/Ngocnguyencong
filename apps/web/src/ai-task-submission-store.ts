import type { PostgresDatabaseLifecycle, RecordTaskRunInput, TaskResult } from "@supastack/db";
import { taskRun } from "@supastack/db";
import { and, eq, sql } from "drizzle-orm";

const taskFields = {
  completedAt: taskRun.completedAt,
  id: taskRun.id,
  result: taskRun.result,
  status: taskRun.status,
  workspaceId: taskRun.workspaceId,
};

export function createAiTaskSubmissionStore(database: PostgresDatabaseLifecycle["database"]) {
  return async (input: RecordTaskRunInput): Promise<TaskResult | null> => {
    const [created] = await database
      .insert(taskRun)
      .values(input)
      .onConflictDoNothing({ target: taskRun.id })
      .returning(taskFields);
    if (created) return created;
    const [existing] = await database
      .select(taskFields)
      .from(taskRun)
      .where(
        and(
          eq(taskRun.id, input.id),
          eq(taskRun.workspaceId, input.workspaceId),
          eq(taskRun.taskName, input.taskName),
          sql`${taskRun.input} = ${JSON.stringify(input.input)}::jsonb`,
        ),
      )
      .limit(1);
    return existing ?? null;
  };
}

export async function readAiTaskSubmission(
  database: PostgresDatabaseLifecycle["database"],
  input: { taskId: string; workspaceId: string },
) {
  const [record] = await database
    .select({ ...taskFields, input: taskRun.input })
    .from(taskRun)
    .where(
      and(
        eq(taskRun.id, input.taskId),
        eq(taskRun.workspaceId, input.workspaceId),
        eq(taskRun.taskName, "ai.generate"),
      ),
    )
    .limit(1);
  if (!record) return null;
  const { input: savedInput, ...task } = record;
  return { task, input: savedInput };
}
