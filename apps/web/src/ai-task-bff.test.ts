import { describe, expect, it, vi } from "vitest";

import { createAiTaskBff, type AiTaskBffDependencies } from "./ai-task-bff.js";

const trustedHeaders = new Headers({ origin: "https://app.example.test" });

function createDependencies(overrides: Partial<AiTaskBffDependencies> = {}): AiTaskBffDependencies {
  return {
    appUrl: "https://app.example.test",
    checkSubmissionRate: vi.fn(async () => ({
      allowed: true,
      limit: 30,
      remaining: 29,
      retryAfterSeconds: 0,
    })),
    createTaskId: () => "task_123",
    enqueue: vi.fn(async () => ({ id: "run_123", status: "queued" as const })),
    findWorkspaceContext: async () => ({
      completionEmailTo: "owner@example.test",
      hasAiEntitlement: true,
      workspaceId: "workspace-a",
    }),
    getSession: async () => ({ user: { id: "user-a" } }),
    markTaskRunFailed: vi.fn(async () => null),
    readTaskResult: vi.fn(async () => ({
      completedAt: null,
      id: "task_123",
      result: null,
      status: "queued",
      workspaceId: "workspace-a",
    })),
    recordTaskRun: vi.fn(async () => ({
      completedAt: null,
      id: "task_123",
      result: null,
      status: "queued",
      workspaceId: "workspace-a",
    })),
    setTaskRunProviderRunId: vi.fn(async () => ({
      completedAt: null,
      id: "task_123",
      result: null,
      status: "queued",
      workspaceId: "workspace-a",
    })),
    track: vi.fn(),
    ...overrides,
  };
}

describe("production AI task BFF", () => {
  it("rejects a quota-exhausted workspace before recording or enqueueing a new task", async () => {
    const consumeTaskQuota = vi.fn(async () => ({ allowed: false }));
    const dependencies = createDependencies({ consumeTaskQuota });

    await expect(
      createAiTaskBff(dependencies).create(trustedHeaders, {
        alias: "fast",
        prompt: "Hello",
        requirements: {},
      }),
    ).resolves.toMatchObject({ status: 429, body: { error: { code: "quotaExceeded" } } });
    expect(consumeTaskQuota).toHaveBeenCalledWith({
      taskId: "task_123",
      workspaceId: "workspace-a",
    });
    expect(dependencies.recordTaskRun).not.toHaveBeenCalled();
    expect(dependencies.enqueue).not.toHaveBeenCalled();
  });

  it("skips the quota consume for idempotent replays of an existing submission", async () => {
    const consumeTaskQuota = vi.fn(async () => ({ allowed: false }));
    const existing = {
      completedAt: null,
      id: "task_existing",
      result: null,
      status: "queued" as const,
      workspaceId: "workspace-a",
    };
    const dependencies = createDependencies({
      consumeTaskQuota,
      readSubmission: vi.fn(async () => ({
        input: {
          alias: "fast",
          completionEmailTo: "owner@example.test",
          correlationId: "corr_stored",
          prompt: "Hello",
          requirements: {},
        },
        task: existing,
      })),
      reserveTaskRun: vi.fn(async () => existing),
    });
    const headers = new Headers({
      "idempotency-key": "submissionkey1234567",
      origin: "https://app.example.test",
    });

    const response = await createAiTaskBff(dependencies).create(headers, {
      alias: "fast",
      prompt: "Hello",
      requirements: {},
    });

    expect(response.status).not.toBe(429);
    expect(consumeTaskQuota).not.toHaveBeenCalled();
  });

  it("rejects a rate-limited workspace before recording or enqueueing a new task", async () => {
    const dependencies = createDependencies({
      checkSubmissionRate: vi.fn(async () => ({
        allowed: false,
        limit: 30,
        remaining: 0,
        retryAfterSeconds: 60,
      })),
    });

    await expect(
      createAiTaskBff(dependencies).create(trustedHeaders, {
        alias: "fast",
        prompt: "Hello",
        requirements: {},
      }),
    ).resolves.toMatchObject({ status: 429, body: { error: { code: "rateLimited" } } });
    expect(dependencies.recordTaskRun).not.toHaveBeenCalled();
    expect(dependencies.enqueue).not.toHaveBeenCalled();
  });

  it("allows recovery of an existing queued submission when the new-task limit is exhausted", async () => {
    const checkSubmissionRate = vi.fn(async () => ({ allowed: false }));
    const queued = {
      completedAt: null,
      id: "task_existing",
      result: null,
      status: "queued" as const,
      workspaceId: "workspace-a",
    };
    const dependencies = createDependencies({
      checkSubmissionRate,
      readSubmission: vi.fn(async () => ({
        input: {
          alias: "fast",
          completionEmailTo: "owner@example.test",
          prompt: "Original",
          requirements: {},
        },
        task: queued,
      })),
      reserveTaskRun: vi.fn(async () => queued),
    });
    const headers = new Headers(trustedHeaders);
    headers.set("idempotency-key", "request_1234567890");

    await expect(
      createAiTaskBff(dependencies).create(headers, { resume: true }),
    ).resolves.toMatchObject({
      status: 201,
    });
    expect(checkSubmissionRate).not.toHaveBeenCalled();
    expect(dependencies.enqueue).toHaveBeenCalledTimes(1);
  });

  it("resumes with the original server-owned payload without accepting browser replacements", async () => {
    const dependencies = createDependencies();
    const originalInput = {
      alias: "fast",
      prompt: "Original",
      requirements: { vision: true },
      completionEmailTo: "original@example.test",
    };
    const bff = createAiTaskBff({
      ...dependencies,
      readSubmission: async ({ taskId, workspaceId }) => ({
        task: { id: taskId, workspaceId, status: "queued", result: null, completedAt: null },
        input: originalInput,
      }),
      reserveTaskRun: async (input) => ({
        id: input.id,
        workspaceId: input.workspaceId,
        status: "queued",
        result: null,
        completedAt: null,
      }),
    });
    const headers = new Headers(trustedHeaders);
    headers.set("idempotency-key", "request_1234567890");
    expect((await bff.create(headers, { resume: true })).status).toBe(201);
    expect(dependencies.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ input: expect.objectContaining(originalInput) }),
    );
    expect((await bff.create(headers, { resume: true, prompt: "replacement" })).status).toBe(400);
    expect(dependencies.enqueue).toHaveBeenCalledTimes(1);
  });
  it("reuses task and Trigger identity after an ambiguous enqueue failure", async () => {
    let stored: Parameters<AiTaskBffDependencies["recordTaskRun"]>[0] | undefined;
    const reserveTaskRun = vi.fn(
      async (input: Parameters<AiTaskBffDependencies["recordTaskRun"]>[0]) => {
        if (stored && JSON.stringify(stored.input) !== JSON.stringify(input.input)) return null;
        stored ??= input;
        return {
          id: stored.id,
          workspaceId: stored.workspaceId,
          status: "queued",
          result: null,
          completedAt: null,
        };
      },
    );
    const enqueue = vi
      .fn()
      .mockRejectedValueOnce(new Error("ambiguous timeout"))
      .mockResolvedValue({ id: "run_123", status: "queued" });
    const dependencies = createDependencies({ enqueue });
    const bff = createAiTaskBff({
      ...dependencies,
      readSubmission: async () =>
        stored === undefined
          ? null
          : {
              input: stored.input,
              task: {
                completedAt: null,
                id: stored.id,
                result: null,
                status: "queued" as const,
                workspaceId: stored.workspaceId,
              },
            },
      reserveTaskRun,
    });
    const headers = new Headers(trustedHeaders);
    headers.set("idempotency-key", "request_1234567890");
    const input = { alias: "fast", prompt: "Hello", requirements: {} };
    const first = await bff.create(headers, input);
    expect(first.status).toBe(202);
    const second = await bff.create(headers, input);
    expect(second.status).toBe(201);
    expect(enqueue.mock.calls[0]?.[0].idempotencyKey).toBe(
      enqueue.mock.calls[1]?.[0].idempotencyKey,
    );
    expect(dependencies.createTaskId()).not.toBe(stored?.id);
    expect(dependencies.recordTaskRun).not.toHaveBeenCalled();
    expect(dependencies.markTaskRunFailed).not.toHaveBeenCalled();
    expect(reserveTaskRun).toHaveBeenCalledTimes(2);
    await expect(bff.create(headers, { ...input, prompt: "Different" })).resolves.toMatchObject({
      status: 409,
    });
    expect(enqueue).toHaveBeenCalledTimes(2);
  });

  it("returns stored terminal state without re-enqueueing an idempotent replay", async () => {
    const dependencies = createDependencies();
    const bff = createAiTaskBff({
      ...dependencies,
      reserveTaskRun: async (input: Parameters<AiTaskBffDependencies["recordTaskRun"]>[0]) => ({
        id: input.id,
        workspaceId: input.workspaceId,
        status: "completed",
        result: { text: "done" },
        completedAt: new Date(),
      }),
    });
    const headers = new Headers(trustedHeaders);
    headers.set("idempotency-key", "request_1234567890");
    await expect(
      bff.create(headers, { alias: "fast", prompt: "Hello", requirements: {} }),
    ).resolves.toMatchObject({
      status: 200,
      body: { data: { status: "completed", result: { text: "done" } } },
    });
    expect(dependencies.enqueue).not.toHaveBeenCalled();
  });

  it("rejects malformed idempotency keys without task writes", async () => {
    const dependencies = createDependencies();
    const headers = new Headers(trustedHeaders);
    headers.set("idempotency-key", "short");
    await expect(
      createAiTaskBff(dependencies).create(headers, {
        alias: "fast",
        prompt: "Hello",
        requirements: {},
      }),
    ).resolves.toMatchObject({ status: 400 });
    expect(dependencies.recordTaskRun).not.toHaveBeenCalled();
    expect(dependencies.enqueue).not.toHaveBeenCalled();
  });

  it("scopes identical submission keys to the authenticated workspace", async () => {
    const ids: string[] = [];
    const headers = new Headers(trustedHeaders);
    headers.set("idempotency-key", "request_1234567890");
    for (const workspaceId of ["workspace-a", "workspace-b"]) {
      const bff = createAiTaskBff({
        ...createDependencies({
          findWorkspaceContext: async () => ({
            workspaceId,
            hasAiEntitlement: true,
            completionEmailTo: "owner@example.test",
          }),
        }),
        reserveTaskRun: async (input) => {
          ids.push(input.id);
          return { id: input.id, workspaceId, status: "running", completedAt: null, result: null };
        },
      });
      expect(
        (await bff.create(headers, { alias: "fast", prompt: "Hello", requirements: {} })).status,
      ).toBe(200);
    }
    expect(ids[0]).not.toBe(ids[1]);
    expect(ids.every((id) => !id.includes("request_1234567890"))).toBe(true);
  });
  it.each(["throw", "null"])(
    "keeps accepted task identity when metadata attachment returns %s",
    async (failure) => {
      const reportMetadataFailure = vi.fn();
      const dependencies = createDependencies({
        setTaskRunProviderRunId: async () => {
          if (failure === "throw") throw new Error("private database detail");
          return null;
        },
      });
      const bff = createAiTaskBff({ ...dependencies, reportMetadataFailure });
      await expect(
        bff.create(trustedHeaders, { alias: "fast", prompt: "Hello", requirements: {} }),
      ).resolves.toMatchObject({
        status: 201,
        body: { data: { id: "task_123", providerRunId: "run_123" } },
      });
      expect(dependencies.enqueue).toHaveBeenCalledTimes(1);
      expect(dependencies.markTaskRunFailed).not.toHaveBeenCalled();
      expect(reportMetadataFailure).toHaveBeenCalledExactlyOnceWith({
        correlationId: expect.stringMatching(/^corr_/),
        taskId: "task_123",
        providerRunId: "run_123",
        workspaceId: "workspace-a",
      });
      await expect(bff.read(trustedHeaders, "task_123")).resolves.toMatchObject({
        status: 200,
        body: { data: { id: "task_123" } },
      });
    },
  );

  it("does not lose accepted identity when metadata reporting also rejects", async () => {
    const dependencies = createDependencies({ setTaskRunProviderRunId: async () => null });
    const bff = createAiTaskBff({
      ...dependencies,
      reportMetadataFailure: async () => {
        throw new Error("reporter failed");
      },
    });
    await expect(
      bff.create(trustedHeaders, { alias: "fast", prompt: "Hello", requirements: {} }),
    ).resolves.toMatchObject({ status: 201, body: { data: { id: "task_123" } } });
    expect(dependencies.enqueue).toHaveBeenCalledTimes(1);
    expect(dependencies.markTaskRunFailed).not.toHaveBeenCalled();
  });

  it("derives workspace, entitlement, recipient, and worker payload on the server", async () => {
    const recordTaskRun = vi.fn(async () => ({
      completedAt: null,
      id: "task_123",
      result: null,
      status: "queued",
      workspaceId: "workspace-a",
    }));
    const enqueue = vi.fn(async () => ({ id: "run_123", status: "queued" as const }));
    const setTaskRunProviderRunId = vi.fn(async () => ({
      completedAt: null,
      id: "task_123",
      result: null,
      status: "queued",
      workspaceId: "workspace-a",
    }));
    const bff = createAiTaskBff(
      createDependencies({ enqueue, recordTaskRun, setTaskRunProviderRunId }),
    );

    await expect(
      bff.create(trustedHeaders, {
        alias: "smart",
        prompt: "Summarize the attached notes.",
        requirements: { minContext: 32_000, structuredOutput: true },
      }),
    ).resolves.toEqual({
      body: {
        data: {
          id: "task_123",
          providerRunId: "run_123",
          status: "queued",
          workspaceId: "workspace-a",
        },
      },
      status: 201,
    });

    expect(recordTaskRun).toHaveBeenCalledWith({
      id: "task_123",
      input: {
        alias: "smart",
        completionEmailTo: "owner@example.test",
        correlationId: expect.stringMatching(/^corr_/),
        prompt: "Summarize the attached notes.",
        requirements: { minContext: 32_000, structuredOutput: true },
      },
      status: "queued",
      taskName: "ai.generate",
      workspaceId: "workspace-a",
    });
    expect(enqueue).toHaveBeenCalledWith({
      idempotencyKey: "ai-task:task_123",
      input: {
        alias: "smart",
        completionEmailTo: "owner@example.test",
        correlationId: expect.stringMatching(/^corr_/),
        prompt: "Summarize the attached notes.",
        requirements: { minContext: 32_000, structuredOutput: true },
        taskId: "task_123",
        workspaceId: "workspace-a",
      },
      type: "ai.generate",
      workspaceId: "workspace-a",
    });
    expect(setTaskRunProviderRunId).toHaveBeenCalledWith({
      providerRunId: "run_123",
      taskId: "task_123",
      workspaceId: "workspace-a",
    });
  });

  it("mints a corr_ id at intake — one id shared by the durable input, the worker payload, and ai_task_submitted", async () => {
    const dependencies = createDependencies();
    const bff = createAiTaskBff(dependencies);

    await expect(
      bff.create(trustedHeaders, { alias: "fast", prompt: "Hello", requirements: {} }),
    ).resolves.toMatchObject({ status: 201 });

    const recorded = vi.mocked(dependencies.recordTaskRun).mock.calls[0]![0].input as Record<
      string,
      unknown
    >;
    expect(recorded.correlationId).toMatch(/^corr_[0-9a-f-]{36}$/);
    const enqueued = vi.mocked(dependencies.enqueue).mock.calls[0]![0].input as Record<
      string,
      unknown
    >;
    expect(enqueued.correlationId).toBe(recorded.correlationId);
    expect(dependencies.track).toHaveBeenCalledExactlyOnceWith({
      distinctId: "workspace-a",
      name: "ai_task_submitted",
      properties: { correlationId: recorded.correlationId, taskId: "task_123" },
      workspaceId: "workspace-a",
    });
  });

  it("reuses the submission's stored correlationId on resume so the run links to the original intake", async () => {
    const storedInput = {
      alias: "fast",
      completionEmailTo: "owner@example.test",
      correlationId: "corr_stored",
      prompt: "Original",
      requirements: {},
    };
    const reserveTaskRun = vi.fn(
      async (input: Parameters<AiTaskBffDependencies["recordTaskRun"]>[0]) => ({
        completedAt: null,
        id: input.id,
        result: null,
        status: "queued" as const,
        workspaceId: input.workspaceId,
      }),
    );
    const dependencies = createDependencies({
      readSubmission: vi.fn(async () => ({
        input: storedInput,
        task: {
          completedAt: null,
          id: "task_existing",
          result: null,
          status: "queued" as const,
          workspaceId: "workspace-a",
        },
      })),
      reserveTaskRun,
    });
    const headers = new Headers(trustedHeaders);
    headers.set("idempotency-key", "request_1234567890");

    await expect(
      createAiTaskBff(dependencies).create(headers, { resume: true }),
    ).resolves.toMatchObject({ status: 201 });

    // The durable input must satisfy reserveTaskRun's jsonb equality against
    // the stored row (semantic, not byte-level), so it echoes the stored
    // correlationId.
    expect(reserveTaskRun.mock.calls[0]![0].input).toEqual(storedInput);
    const enqueued = vi.mocked(dependencies.enqueue).mock.calls[0]![0].input as Record<
      string,
      unknown
    >;
    expect(enqueued.correlationId).toBe("corr_stored");
    expect(dependencies.track).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "ai_task_submitted",
        properties: expect.objectContaining({ correlationId: "corr_stored" }),
      }),
    );
  });

  it("resolves a racing identical submission as the stored task — not a spurious 409", async () => {
    // Two in-flight requests share one idempotency key: both pre-reserve
    // reads missed the not-yet-inserted row, so the loser mints its own
    // correlationId and the jsonb equality inside reserveTaskRun can never
    // match — same request, not a payload conflict. A single re-read must
    // recover the stored row instead of returning 409.
    let stored: Parameters<NonNullable<AiTaskBffDependencies["reserveTaskRun"]>>[0] | undefined;
    const asTask = (record: NonNullable<typeof stored>) => ({
      completedAt: null,
      id: record.id,
      result: null,
      status: record.status,
      workspaceId: record.workspaceId,
    });
    const reserveTaskRun = vi.fn(
      async (input: Parameters<NonNullable<AiTaskBffDependencies["reserveTaskRun"]>>[0]) => {
        if (stored !== undefined && JSON.stringify(stored.input) !== JSON.stringify(input.input)) {
          return null;
        }
        stored ??= input;
        return asTask(stored);
      },
    );
    const readSubmission = vi.fn(async () =>
      stored === undefined ? null : { input: stored.input, task: asTask(stored) },
    );
    // Force BOTH requests' pre-reserve reads to null — the loser's raced
    // the winner's insert even though `stored` is populated by then. The
    // third call is the post-reserve re-read, which must see the row.
    readSubmission
      .mockImplementationOnce(async () => null)
      .mockImplementationOnce(async () => null);
    const dependencies = createDependencies({ readSubmission, reserveTaskRun });
    const bff = createAiTaskBff(dependencies);
    const headers = new Headers(trustedHeaders);
    headers.set("idempotency-key", "request_1234567890");
    const input = { alias: "fast", prompt: "Hello", requirements: {} };

    await expect(bff.create(headers, input)).resolves.toMatchObject({ status: 201 });
    const storedCorrelationId = stored!.input.correlationId;
    expect(storedCorrelationId).toMatch(/^corr_[0-9a-f-]{36}$/);

    await expect(bff.create(headers, input)).resolves.toMatchObject({ status: 201 });
    expect(readSubmission).toHaveBeenCalledTimes(3); // 2 pre-reserve + 1 race re-read
    expect(reserveTaskRun).toHaveBeenCalledTimes(2);
    // The loser's discarded mint never leaks — the run joins the stored row.
    expect(vi.mocked(dependencies.enqueue).mock.calls[1]![0].input).toMatchObject({
      correlationId: storedCorrelationId,
    });
    expect(dependencies.track).toHaveBeenCalledTimes(2);
    expect(vi.mocked(dependencies.track!).mock.calls[1]![0]).toMatchObject({
      name: "ai_task_submitted",
      properties: { correlationId: storedCorrelationId },
    });
  });

  it("still 409s a reserve miss when the stored row is genuinely a different request", async () => {
    // Same key, different prompt — the re-read must NOT paper over a real
    // idempotency conflict.
    const storedInput = {
      alias: "fast",
      completionEmailTo: "owner@example.test",
      correlationId: "corr_stored",
      prompt: "Different prompt",
      requirements: {},
    };
    const storedTask = {
      completedAt: null,
      id: "task_existing",
      result: null,
      status: "queued" as const,
      workspaceId: "workspace-a",
    };
    const dependencies = createDependencies({
      readSubmission: vi.fn(async () => ({ input: storedInput, task: storedTask })),
      reserveTaskRun: vi.fn(async () => null),
    });
    const headers = new Headers(trustedHeaders);
    headers.set("idempotency-key", "request_1234567890");

    await expect(
      createAiTaskBff(dependencies).create(headers, {
        alias: "fast",
        prompt: "Hello",
        requirements: {},
      }),
    ).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "idempotencyConflict" } },
    });
    expect(dependencies.enqueue).not.toHaveBeenCalled();
  });

  it("keeps a legacy stored input unchanged on replay while still minting a fresh correlationId for the run", async () => {
    // Rows written before correlation ids existed carry none — re-adding the
    // field to the durable input would break reserveTaskRun's jsonb-equality
    // idempotency check and 409 a perfectly valid replay.
    const storedInput = {
      alias: "fast",
      completionEmailTo: "owner@example.test",
      prompt: "Hello",
      requirements: {},
    };
    const reserveTaskRun = vi.fn(
      async (input: Parameters<AiTaskBffDependencies["recordTaskRun"]>[0]) => ({
        completedAt: null,
        id: input.id,
        result: null,
        status: "queued" as const,
        workspaceId: input.workspaceId,
      }),
    );
    const dependencies = createDependencies({
      readSubmission: vi.fn(async () => ({
        input: storedInput,
        task: {
          completedAt: null,
          id: "task_existing",
          result: null,
          status: "queued" as const,
          workspaceId: "workspace-a",
        },
      })),
      reserveTaskRun,
    });
    const headers = new Headers(trustedHeaders);
    headers.set("idempotency-key", "request_1234567890");

    await expect(
      createAiTaskBff(dependencies).create(headers, {
        alias: "fast",
        prompt: "Hello",
        requirements: {},
      }),
    ).resolves.toMatchObject({ status: 201 });

    expect(reserveTaskRun.mock.calls[0]![0].input).toEqual(storedInput);
    const enqueued = vi.mocked(dependencies.enqueue).mock.calls[0]![0].input as Record<
      string,
      unknown
    >;
    expect(enqueued.correlationId).toMatch(/^corr_[0-9a-f-]{36}$/);
    expect(dependencies.track).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({
          correlationId: enqueued.correlationId,
        }),
      }),
    );
  });

  it("rejects cross-origin cookies before reading the session", async () => {
    const getSession = vi.fn(async () => ({ user: { id: "user-a" } }));
    const bff = createAiTaskBff(createDependencies({ getSession }));

    await expect(
      bff.create(new Headers({ origin: "https://attacker.example.test" }), {
        alias: "fast",
        prompt: "Hello",
        requirements: {},
      }),
    ).resolves.toMatchObject({ status: 403 });
    expect(getSession).not.toHaveBeenCalled();
  });

  it("requires an active server-derived entitlement before enqueueing", async () => {
    const enqueue = vi.fn();
    const bff = createAiTaskBff(
      createDependencies({
        enqueue,
        findWorkspaceContext: async () => ({
          completionEmailTo: "owner@example.test",
          hasAiEntitlement: false,
          workspaceId: "workspace-a",
        }),
      }),
    );

    await expect(
      bff.create(trustedHeaders, { alias: "cheap", prompt: "Hello", requirements: {} }),
    ).resolves.toMatchObject({ status: 403 });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("marks its own durable task failed when enqueueing the worker fails", async () => {
    const failure = new Error("Trigger unavailable");
    const markTaskRunFailed = vi.fn(async () => null);
    const bff = createAiTaskBff(
      createDependencies({
        enqueue: async () => {
          throw failure;
        },
        markTaskRunFailed,
      }),
    );

    await expect(
      bff.create(trustedHeaders, { alias: "fast", prompt: "Hello", requirements: {} }),
    ).rejects.toBe(failure);
    expect(markTaskRunFailed).toHaveBeenCalledWith({
      completedAt: expect.any(Date),
      errorCode: "enqueue_failed",
      taskId: "task_123",
      workspaceId: "workspace-a",
    });
  });

  it("reads a task only after deriving the requester workspace", async () => {
    const readTaskResult = vi.fn(async () => ({
      completedAt: null,
      id: "task_123",
      result: null,
      status: "queued",
      workspaceId: "workspace-a",
    }));
    const bff = createAiTaskBff(createDependencies({ readTaskResult }));

    await expect(bff.read(new Headers(), "task_123")).resolves.toEqual({
      body: {
        data: {
          completedAt: null,
          id: "task_123",
          result: null,
          status: "queued",
          workspaceId: "workspace-a",
        },
      },
      status: 200,
    });
    expect(readTaskResult).toHaveBeenCalledWith({ taskId: "task_123", workspaceId: "workspace-a" });
  });
});

describe("explicit caller identity (v1 API-key path)", () => {
  const caller = { userId: "user-key", workspaceId: "workspace-key" };

  it("creates without invoking getSession and scopes the context to the caller workspace", async () => {
    const getSession = vi.fn(async () => null);
    const findWorkspaceContext = vi.fn(async () => ({
      completionEmailTo: "key-owner@example.test",
      hasAiEntitlement: true,
      workspaceId: "workspace-key",
    }));
    const recordTaskRun = vi.fn(async () => ({
      completedAt: null,
      id: "task_123",
      result: null,
      status: "queued",
      workspaceId: "workspace-key",
    }));
    const bff = createAiTaskBff(
      createDependencies({ findWorkspaceContext, getSession, recordTaskRun }),
    );

    const response = await bff.create(
      trustedHeaders,
      { alias: "fast", prompt: "Hello", requirements: {} },
      caller,
    );
    expect(response.status).toBe(201);
    expect(getSession).not.toHaveBeenCalled();
    expect(findWorkspaceContext).toHaveBeenCalledWith("user-key", "workspace-key", "write");
    expect(recordTaskRun).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "workspace-key" }),
    );
  });

  it("still enforces the same-origin invariant for explicit callers", async () => {
    const getSession = vi.fn(async () => null);
    const dependencies = createDependencies({ getSession });
    const bff = createAiTaskBff(dependencies);

    await expect(
      bff.create(
        new Headers({ origin: "https://attacker.example.test" }),
        { alias: "fast", prompt: "Hello", requirements: {} },
        caller,
      ),
    ).resolves.toMatchObject({ status: 403 });
    expect(getSession).not.toHaveBeenCalled();
    expect(dependencies.enqueue).not.toHaveBeenCalled();
  });

  it("still validates the idempotency key for explicit callers", async () => {
    const dependencies = createDependencies({
      findWorkspaceContext: async () => ({
        completionEmailTo: "key-owner@example.test",
        hasAiEntitlement: true,
        workspaceId: "workspace-key",
      }),
    });
    const headers = new Headers(trustedHeaders);
    headers.set("idempotency-key", "short");

    await expect(
      createAiTaskBff(dependencies).create(
        headers,
        { alias: "fast", prompt: "Hello", requirements: {} },
        caller,
      ),
    ).resolves.toMatchObject({ status: 400 });
    expect(dependencies.recordTaskRun).not.toHaveBeenCalled();
    expect(dependencies.enqueue).not.toHaveBeenCalled();
  });

  it("rejects when the resolved context does not belong to the caller workspace", async () => {
    const dependencies = createDependencies({
      findWorkspaceContext: async () => ({
        completionEmailTo: "owner@example.test",
        hasAiEntitlement: true,
        workspaceId: "workspace-a",
      }),
    });
    const bff = createAiTaskBff(dependencies);

    await expect(
      bff.create(trustedHeaders, { alias: "fast", prompt: "Hello", requirements: {} }, caller),
    ).resolves.toMatchObject({ status: 403 });
    expect(dependencies.recordTaskRun).not.toHaveBeenCalled();
    expect(dependencies.enqueue).not.toHaveBeenCalled();
  });

  it("reads without invoking getSession and scopes the lookup to the caller workspace", async () => {
    const getSession = vi.fn(async () => null);
    const findWorkspaceContext = vi.fn(async () => ({
      completionEmailTo: "key-owner@example.test",
      hasAiEntitlement: true,
      workspaceId: "workspace-key",
    }));
    const readTaskResult = vi.fn(async () => ({
      completedAt: null,
      id: "task_123",
      result: null,
      status: "queued",
      workspaceId: "workspace-key",
    }));
    const bff = createAiTaskBff(
      createDependencies({ findWorkspaceContext, getSession, readTaskResult }),
    );

    await expect(bff.read(new Headers(), "task_123", caller)).resolves.toMatchObject({
      status: 200,
      body: { data: { id: "task_123", workspaceId: "workspace-key" } },
    });
    expect(getSession).not.toHaveBeenCalled();
    expect(findWorkspaceContext).toHaveBeenCalledWith("user-key", "workspace-key");
    expect(readTaskResult).toHaveBeenCalledWith({
      taskId: "task_123",
      workspaceId: "workspace-key",
    });
  });

  it("returns notFound when the caller is not a member of the pinned workspace", async () => {
    const bff = createAiTaskBff(createDependencies({ findWorkspaceContext: async () => null }));
    await expect(bff.read(new Headers(), "task_123", caller)).resolves.toMatchObject({
      status: 404,
    });
  });
});
