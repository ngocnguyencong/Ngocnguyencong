import { createHash } from "node:crypto";

import type { ModelAlias, ModelRequirements } from "@supastack/ai";
import type {
  MarkTaskRunFailedInput,
  ReadTaskResultInput,
  RecordTaskRunInput,
  SetTaskRunProviderRunIdInput,
  TaskResult,
} from "@supastack/db";
import type { Job, JobInput } from "@supastack/jobs";
import { newCorrelationId, type AnalyticsEvent } from "@supastack/observability";

export type AiTaskCreateInput = Readonly<{
  alias: ModelAlias;
  prompt: string;
  requirements: ModelRequirements;
}>;

export type AiTaskTriggerEnqueueInput = JobInput &
  Readonly<{
    idempotencyKey: string;
  }>;

export type AiTaskWorkspaceContext = Readonly<{
  completionEmailTo: string;
  hasAiEntitlement: boolean;
  workspaceId: string;
}>;

/**
 * Identity resolved upstream (e.g. the /api/v1 BFF for `sk_` callers). When
 * present, `getSession` is skipped and `workspaceId` pins the workspace
 * context lookup instead of defaulting to the user's first membership.
 */
export type AiTaskCaller = Readonly<{ userId: string; workspaceId: string }>;

export interface AiTaskBffDependencies {
  appUrl: string;
  checkSubmissionRate(input: {
    userId: string;
    workspaceId: string;
  }): Promise<{ allowed: boolean }>;
  createTaskId(): string;
  /**
   * Optional metered-quota consume for genuinely-new submissions — wired to
   * `consumeQuota` (plan `usageLimits` first, prepaid-credit overflow after).
   * Replays/resumes skip it like the rate check, so a stored submission can
   * never be charged twice. Absent = the intake is unmetered.
   */
  consumeTaskQuota?(input: {
    taskId: string;
    workspaceId: string;
  }): Promise<Readonly<{ allowed: boolean }>>;
  enqueue(input: AiTaskTriggerEnqueueInput): Promise<Pick<Job, "id" | "status">>;
  findWorkspaceContext(
    userId: string,
    workspaceId?: string,
    access?: "read" | "write",
  ): Promise<AiTaskWorkspaceContext | null>;
  getSession(headers: Headers): Promise<Readonly<{ user: Readonly<{ id: string }> }> | null>;
  markTaskRunFailed(input: MarkTaskRunFailedInput): Promise<TaskResult | null>;
  readTaskResult(input: ReadTaskResultInput): Promise<TaskResult | null>;
  reportMetadataFailure?(
    input: Readonly<{
      correlationId: string;
      providerRunId: string;
      taskId: string;
      workspaceId: string;
    }>,
  ): void | Promise<void>;
  recordTaskRun(input: RecordTaskRunInput): Promise<TaskResult>;
  /**
   * `reserveTaskRun` and `readSubmission` MUST be wired together.
   * Pre-reserve replay reads, the post-reserve same-request-race re-read,
   * and stored-correlationId reuse all go through `readSubmission` — wiring
   * `reserveTaskRun` alone turns every replay of a correlation-bearing row
   * into a false 409 (a fresh mint never equals the stored jsonb).
   */
  reserveTaskRun?(input: RecordTaskRunInput): Promise<TaskResult | null>;
  readSubmission?(
    input: ReadTaskResultInput,
  ): Promise<Readonly<{ task: TaskResult; input: Record<string, unknown> }> | null>;
  setTaskRunProviderRunId(input: SetTaskRunProviderRunIdInput): Promise<TaskResult | null>;
  /** Intake metrics sink — receives `ai_task_submitted`; production wires `serverObservability.track`. */
  track?(event: AnalyticsEvent): void;
}

export function createAiTaskBff(dependencies: AiTaskBffDependencies) {
  return Object.freeze({
    async create(headers: Headers, rawInput: unknown, caller?: AiTaskCaller) {
      if (!isSameOrigin(headers, dependencies.appUrl)) {
        return errorResponse(403, "forbidden", "The request origin is not allowed.");
      }

      const userId = await resolveUserId(headers, caller);
      if (userId === null) {
        return errorResponse(401, "unauthorized", "Authentication is required.");
      }
      const context = await dependencies.findWorkspaceContext(userId, caller?.workspaceId, "write");
      if (
        context === null ||
        (caller !== undefined && context.workspaceId !== caller.workspaceId)
      ) {
        return errorResponse(403, "workspaceUnavailable", "No workspace is available.");
      }
      if (!context.hasAiEntitlement) {
        return errorResponse(403, "entitlementRequired", "An active AI entitlement is required.");
      }

      const submissionKey = headers.get("idempotency-key");
      if (submissionKey !== null && !/^[A-Za-z0-9_-]{16,128}$/.test(submissionKey)) {
        return errorResponse(400, "validationError", "A valid idempotency key is required.");
      }
      if (submissionKey !== null && dependencies.reserveTaskRun === undefined) {
        return errorResponse(
          503,
          "providerUnavailable",
          "Durable submission recovery is unavailable.",
        );
      }
      const taskId =
        submissionKey === null
          ? dependencies.createTaskId()
          : `task_${createHash("sha256")
              .update(JSON.stringify([context.workspaceId, submissionKey]))
              .digest("hex")}`;
      let savedInput: Record<string, unknown> | undefined;
      let hasExistingSubmission = false;
      if (isRecord(rawInput) && rawInput.resume === true) {
        if (Object.keys(rawInput).length !== 1 || submissionKey === null) {
          return errorResponse(400, "validationError", "A valid resume request is required.");
        }
        if (!dependencies.readSubmission) {
          return errorResponse(
            503,
            "providerUnavailable",
            "Durable submission recovery is unavailable.",
          );
        }
        const saved = await dependencies.readSubmission({
          taskId,
          workspaceId: context.workspaceId,
        });
        if (saved === null) return errorResponse(404, "notFound", "The submission was not found.");
        hasExistingSubmission = true;
        if (saved.task.status !== "queued")
          return { body: { data: saved.task }, status: 200 } as const;
        savedInput = saved.input;
      }
      const input = parseCreateInput(savedInput ?? rawInput);
      if (input === null || (savedInput && typeof savedInput.completionEmailTo !== "string")) {
        return errorResponse(400, "validationError", "A valid AI task request is required.");
      }
      let existingInput: Record<string, unknown> | undefined;
      if (!hasExistingSubmission && submissionKey !== null && dependencies.readSubmission) {
        const existing = await dependencies.readSubmission({
          taskId,
          workspaceId: context.workspaceId,
        });
        hasExistingSubmission = existing !== null;
        existingInput = existing?.input;
      }
      if (
        !hasExistingSubmission &&
        !(await dependencies.checkSubmissionRate({ userId, workspaceId: context.workspaceId }))
          .allowed
      ) {
        return errorResponse(429, "rateLimited", "Too many AI tasks. Try again shortly.");
      }
      // Quota consume sits inside the same new-submission gate as the rate
      // check: idempotent replays and resumes never reach it, so a stored
      // task is charged exactly once.
      if (
        !hasExistingSubmission &&
        dependencies.consumeTaskQuota !== undefined &&
        !(
          await dependencies.consumeTaskQuota({
            taskId,
            workspaceId: context.workspaceId,
          })
        ).allowed
      ) {
        return errorResponse(429, "quotaExceeded", "The workspace usage quota is exhausted.");
      }
      // One corr_ id joins this intake request to the durable task, the
      // worker payload, and every downstream observability emit. Replays and
      // resumes reuse the stored id so the run links back to the ORIGINAL
      // request — and so the rebuilt durable input satisfies reserveTaskRun's
      // exact jsonb-equality idempotency check against the stored row.
      const storedCorrelationId = readCorrelationId(savedInput) ?? readCorrelationId(existingInput);
      let correlationId = storedCorrelationId ?? newCorrelationId();
      const durableInput = {
        alias: input.alias,
        completionEmailTo: savedInput
          ? (savedInput.completionEmailTo as string)
          : context.completionEmailTo,
        // Persist on new rows and on replays of rows that already carry one.
        // A legacy row without it must keep its stored shape unchanged —
        // injecting the fresh id would break the jsonb equality check and
        // 409 the replay as a payload conflict.
        ...(hasExistingSubmission && storedCorrelationId === undefined ? {} : { correlationId }),
        prompt: input.prompt,
        requirements: input.requirements,
      };
      const taskRecord = {
        id: taskId,
        input: durableInput,
        status: "queued",
        taskName: "ai.generate",
        workspaceId: context.workspaceId,
      };
      if (submissionKey !== null && dependencies.reserveTaskRun !== undefined) {
        let existing = await dependencies.reserveTaskRun(taskRecord);
        if (existing === null && dependencies.readSubmission !== undefined) {
          // A null reserve is usually a real payload conflict — but a
          // same-request race produces it too: two in-flight submissions
          // under this key both found no row, minted different correlation
          // ids, and the loser's durable input can never equal the winner's
          // stored jsonb. Re-read once and re-verify with the stored row's
          // own correlationId substituted in before declaring a conflict.
          const raced = await dependencies.readSubmission({
            taskId,
            workspaceId: context.workspaceId,
          });
          if (raced !== null && isSameSubmissionInput(durableInput, raced.input)) {
            existing = raced.task;
            // Downstream emits join the stored row's chain, not this
            // request's discarded mint. A legacy stored row without the
            // field keeps the fresh id — it rides the enqueue payload only,
            // exactly like any other legacy replay.
            correlationId = readCorrelationId(raced.input) ?? correlationId;
          }
        }
        if (existing === null) {
          return errorResponse(
            409,
            "idempotencyConflict",
            "This submission key was used for a different request.",
          );
        }
        if (existing.status !== "queued") {
          return { body: { data: existing }, status: 200 } as const;
        }
      } else {
        await dependencies.recordTaskRun(taskRecord);
      }

      // The durable record is accepted — the intake event fires even when
      // the enqueue outcome is ambiguous (the 202 path below still resolves
      // to the same task/correlation pair on replay).
      try {
        dependencies.track?.({
          distinctId: context.workspaceId,
          name: "ai_task_submitted",
          properties: { correlationId, taskId },
          workspaceId: context.workspaceId,
        });
      } catch {
        // Best-effort telemetry must not fail an accepted submission.
      }

      let job: Pick<Job, "id" | "status">;
      try {
        job = await dependencies.enqueue({
          idempotencyKey: `ai-task:${taskId}`,
          input: { ...durableInput, correlationId, taskId, workspaceId: context.workspaceId },
          type: "ai.generate",
          workspaceId: context.workspaceId,
        });
      } catch (error) {
        if (submissionKey !== null) {
          // The provider may have accepted this request. Keep the durable task recoverable.
          return {
            body: { data: { id: taskId, status: "queued", workspaceId: context.workspaceId } },
            status: 202,
          } as const;
        }
        await dependencies.markTaskRunFailed({
          completedAt: new Date(),
          errorCode: "enqueue_failed",
          taskId,
          workspaceId: context.workspaceId,
        });
        throw error;
      }

      const metadata = { providerRunId: job.id, taskId, workspaceId: context.workspaceId };
      let metadataAttached = false;
      try {
        metadataAttached = (await dependencies.setTaskRunProviderRunId(metadata)) !== null;
      } catch {
        // Enqueue is already confirmed. Metadata failure must not invalidate acceptance.
      }
      if (!metadataAttached) {
        try {
          // The diagnostic context carries the correlation id so the error
          // joins the same request→task chain; the repository write itself
          // keeps its minimal input shape.
          await dependencies.reportMetadataFailure?.({ ...metadata, correlationId });
        } catch {
          // Diagnostics cannot replace the accepted task identity either.
        }
      }

      return {
        body: {
          data: {
            id: taskId,
            providerRunId: job.id,
            status: job.status,
            workspaceId: context.workspaceId,
          },
        },
        status: 201,
      } as const;
    },

    async read(headers: Headers, taskId: string, caller?: AiTaskCaller) {
      const userId = await resolveUserId(headers, caller);
      if (userId === null) {
        return errorResponse(401, "unauthorized", "Authentication is required.");
      }
      const context = await dependencies.findWorkspaceContext(userId, caller?.workspaceId);
      if (
        context === null ||
        (caller !== undefined && context.workspaceId !== caller.workspaceId)
      ) {
        return errorResponse(404, "notFound", "The task was not found.");
      }
      const task = await dependencies.readTaskResult({ taskId, workspaceId: context.workspaceId });
      if (task === null) {
        return errorResponse(404, "notFound", "The task was not found.");
      }

      return { body: { data: task }, status: 200 } as const;
    },
  });

  async function resolveUserId(headers: Headers, caller?: AiTaskCaller) {
    if (caller !== undefined) {
      return caller.userId;
    }
    const session = await dependencies.getSession(headers);
    return session?.user.id ?? null;
  }
}

function parseCreateInput(value: unknown): AiTaskCreateInput | null {
  if (!isRecord(value) || !isAlias(value.alias) || !isRecord(value.requirements)) {
    return null;
  }
  if (
    typeof value.prompt !== "string" ||
    value.prompt.trim().length === 0 ||
    value.prompt.length > 100_000
  ) {
    return null;
  }

  const allowed = new Set(["minContext", "structuredOutput", "tools", "vision"]);
  if (Object.keys(value.requirements).some((key) => !allowed.has(key))) {
    return null;
  }
  for (const key of ["structuredOutput", "tools", "vision"] as const) {
    if (value.requirements[key] !== undefined && typeof value.requirements[key] !== "boolean") {
      return null;
    }
  }
  if (
    value.requirements.minContext !== undefined &&
    (!Number.isSafeInteger(value.requirements.minContext) ||
      (value.requirements.minContext as number) < 0)
  ) {
    return null;
  }

  return Object.freeze({
    alias: value.alias,
    prompt: value.prompt,
    requirements: Object.freeze({ ...value.requirements }),
  });
}

function isSameOrigin(headers: Headers, appUrl: string): boolean {
  const origin = headers.get("origin");
  try {
    return origin !== null && new URL(origin).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}

function isAlias(value: unknown): value is ModelAlias {
  return value === "fast" || value === "smart" || value === "cheap";
}

/**
 * Semantic equality between the durable input this request would write and
 * the stored row's input, with the STORED row's correlationId substituted
 * into the candidate first: `correlationId` is per-row, not per-request —
 * a same-request race mints a different id than the winner's stored row, so
 * the field must be reconciled before comparing the rest.
 */
function isSameSubmissionInput(
  candidate: Record<string, unknown>,
  stored: Record<string, unknown>,
): boolean {
  const storedCorrelationId = readCorrelationId(stored);
  const adjusted = { ...candidate };
  delete adjusted.correlationId;
  if (storedCorrelationId !== undefined) {
    adjusted.correlationId = storedCorrelationId;
  }
  return jsonEquals(adjusted, stored);
}

/** Structural equality over jsonb values — key order is not significant. */
function jsonEquals(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => jsonEquals(item, b[index]))
    );
  }
  if (!isRecord(a) || !isRecord(b)) {
    return false;
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return (
    aKeys.length === bKeys.length &&
    aKeys.every((key) => Object.hasOwn(b, key) && jsonEquals(a[key], b[key]))
  );
}

/** Stored `task_run.input` carries the intake's correlation id; absent on legacy rows. */
function readCorrelationId(input: Record<string, unknown> | undefined): string | undefined {
  return input !== undefined &&
    typeof input.correlationId === "string" &&
    input.correlationId.length > 0
    ? input.correlationId
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorResponse(status: number, code: string, message: string) {
  return { body: { error: { code, message } }, status } as const;
}
