import { describe, expect, test } from "vitest";

type JobsApi = {
  LocalJobRunner: new () => {
    enqueue(input: {
      workspaceId: string;
      type: string;
      input: unknown;
    }): Promise<{ id: string; workspaceId: string; status: "queued" }>;
    status(input: {
      workspaceId: string;
      jobId: string;
    }): Promise<{ id: string; workspaceId: string; status: "queued" | "cancelled" } | undefined>;
    cancel(input: {
      workspaceId: string;
      jobId: string;
    }): Promise<{ id: string; workspaceId: string; status: "cancelled" }>;
  };
  TriggerJobRunner: new (client: {
    tasks: {
      trigger(taskIdentifier: string, payload: unknown): Promise<{ id: string }>;
    };
    runs: {
      retrieve(runId: string): Promise<{ id: string; status: string }>;
      cancel(runId: string): Promise<{ id: string }>;
    };
  }) => {
    enqueue(input: {
      workspaceId: string;
      type: string;
      input: unknown;
    }): Promise<{ id: string; workspaceId: string; status: "queued" }>;
    status(input: { workspaceId: string; jobId: string }): Promise<
      | {
          id: string;
          workspaceId: string;
          status: "queued" | "running" | "completed" | "failed" | "cancelled";
        }
      | undefined
    >;
    cancel(input: {
      workspaceId: string;
      jobId: string;
    }): Promise<{ id: string; workspaceId: string; status: "cancelled" }>;
  };
  TriggerWorkflowClient: new (client: {
    tasks: {
      trigger(
        taskIdentifier: string,
        payload: unknown,
        options: { idempotencyKey?: string; queue?: string; delay?: string },
      ): Promise<{ id: string }>;
    };
  }) => {
    triggerWorkflow(input: {
      taskIdentifier: string;
      payload: unknown;
      options: { idempotencyKey?: string; queue?: string; delay?: string };
    }): Promise<{ id: string }>;
  };
};

const jobsApi = (await import("./index.js").catch(() => undefined)) as Partial<JobsApi> | undefined;

function createJobRunner(): InstanceType<JobsApi["LocalJobRunner"]> {
  expect(jobsApi).toBeDefined();
  expect(jobsApi).toHaveProperty("LocalJobRunner");
  return new jobsApi!.LocalJobRunner!();
}

function createTriggerJobRunner(
  client: ConstructorParameters<JobsApi["TriggerJobRunner"]>[0],
): InstanceType<JobsApi["TriggerJobRunner"]> {
  expect(jobsApi).toBeDefined();
  expect(jobsApi).toHaveProperty("TriggerJobRunner");
  return new jobsApi!.TriggerJobRunner!(client);
}

function createTriggerWorkflowClient(
  client: ConstructorParameters<JobsApi["TriggerWorkflowClient"]>[0],
): InstanceType<JobsApi["TriggerWorkflowClient"]> {
  expect(jobsApi).toBeDefined();
  expect(jobsApi).toHaveProperty("TriggerWorkflowClient");
  return new jobsApi!.TriggerWorkflowClient!(client);
}

describe("LocalJobRunner", () => {
  test("enqueues a deterministic queued job and reports its status", async () => {
    const jobs = createJobRunner();

    const job = await jobs.enqueue({
      workspaceId: "workspace-a",
      type: "reference-ai-task",
      input: { prompt: "Write a concise summary" },
    });

    expect(job).toMatchObject({ workspaceId: "workspace-a", status: "queued" });
    await expect(jobs.status({ workspaceId: "workspace-a", jobId: job.id })).resolves.toEqual(job);
  });

  test("does not reveal a job status to another workspace", async () => {
    const jobs = createJobRunner();
    const job = await jobs.enqueue({
      workspaceId: "workspace-a",
      type: "reference-ai-task",
      input: { prompt: "Write a concise summary" },
    });

    await expect(
      jobs.status({ workspaceId: "workspace-b", jobId: job.id }),
    ).resolves.toBeUndefined();
  });

  test("cancels a queued job without adding workflow semantics", async () => {
    const jobs = createJobRunner();
    const job = await jobs.enqueue({
      workspaceId: "workspace-a",
      type: "reference-ai-task",
      input: { prompt: "Write a concise summary" },
    });

    await expect(jobs.cancel({ workspaceId: "workspace-a", jobId: job.id })).resolves.toMatchObject(
      { id: job.id, status: "cancelled" },
    );
    await expect(jobs.status({ workspaceId: "workspace-a", jobId: job.id })).resolves.toMatchObject(
      { id: job.id, status: "cancelled" },
    );
  });
});

describe("TriggerJobRunner", () => {
  test("enqueues a workspace-bearing payload through the Trigger task API", async () => {
    const calls: unknown[] = [];
    const jobs = createTriggerJobRunner({
      tasks: {
        async trigger(taskIdentifier, payload) {
          calls.push([taskIdentifier, payload]);
          return { id: "run_123" };
        },
      },
      runs: {
        async retrieve() {
          return { id: "run_123", status: "QUEUED" };
        },
        async cancel() {
          return { id: "run_123" };
        },
      },
    });

    await expect(
      jobs.enqueue({
        workspaceId: "workspace-a",
        type: "reference-ai-task",
        input: { prompt: "Write a concise summary" },
      }),
    ).resolves.toMatchObject({ id: "run_123", workspaceId: "workspace-a", status: "queued" });
    expect(calls).toEqual([
      [
        "reference-ai-task",
        { workspaceId: "workspace-a", input: { prompt: "Write a concise summary" } },
      ],
    ]);
  });

  test("maps Trigger run status and refuses a cross-workspace lookup", async () => {
    let retrieveCalls = 0;
    const jobs = createTriggerJobRunner({
      tasks: {
        async trigger() {
          return { id: "run_123" };
        },
      },
      runs: {
        async retrieve() {
          retrieveCalls += 1;
          return { id: "run_123", status: "EXECUTING" };
        },
        async cancel() {
          return { id: "run_123" };
        },
      },
    });
    const job = await jobs.enqueue({
      workspaceId: "workspace-a",
      type: "reference-ai-task",
      input: { prompt: "Write a concise summary" },
    });

    await expect(jobs.status({ workspaceId: "workspace-a", jobId: job.id })).resolves.toMatchObject(
      { id: "run_123", status: "running" },
    );
    await expect(
      jobs.status({ workspaceId: "workspace-b", jobId: job.id }),
    ).resolves.toBeUndefined();
    expect(retrieveCalls).toBe(1);
  });

  test("cancels the Trigger run without adding workflow controls to JobRunner", async () => {
    const cancelled: string[] = [];
    const jobs = createTriggerJobRunner({
      tasks: {
        async trigger() {
          return { id: "run_123" };
        },
      },
      runs: {
        async retrieve() {
          return { id: "run_123", status: "CANCELED" };
        },
        async cancel(runId) {
          cancelled.push(runId);
          return { id: runId };
        },
      },
    });
    const job = await jobs.enqueue({
      workspaceId: "workspace-a",
      type: "reference-ai-task",
      input: { prompt: "Write a concise summary" },
    });

    await expect(jobs.cancel({ workspaceId: "workspace-a", jobId: job.id })).resolves.toMatchObject(
      { id: "run_123", status: "cancelled" },
    );
    expect(cancelled).toEqual(["run_123"]);
  });
});

describe("TriggerWorkflowClient", () => {
  test("keeps Trigger queue and delay semantics on an explicitly named API", async () => {
    const calls: unknown[] = [];
    const workflow = createTriggerWorkflowClient({
      tasks: {
        async trigger(taskIdentifier, payload, options) {
          calls.push([taskIdentifier, payload, options]);
          return { id: "run_workflow_123" };
        },
      },
    });

    await expect(
      workflow.triggerWorkflow({
        taskIdentifier: "nightly-summary",
        payload: { workspaceId: "workspace-a" },
        options: { queue: "reports", delay: "1h", idempotencyKey: "summary-a" },
      }),
    ).resolves.toEqual({ id: "run_workflow_123" });
    expect(calls).toEqual([
      [
        "nightly-summary",
        { workspaceId: "workspace-a" },
        { queue: "reports", delay: "1h", idempotencyKey: "summary-a" },
      ],
    ]);
  });
});
