export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type JobInput = Readonly<{
  workspaceId: string;
  type: string;
  input: unknown;
}>;

export type Job = Readonly<{
  id: string;
  workspaceId: string;
  type: string;
  input: unknown;
  status: JobStatus;
}>;

export type JobStatusQuery = Readonly<{
  workspaceId: string;
  jobId: string;
}>;

export interface JobRunner {
  enqueue(input: JobInput): Promise<Job>;
  status(input: JobStatusQuery): Promise<Job | undefined>;
  cancel(input: JobStatusQuery): Promise<Job>;
}

export class JobNotFoundError extends Error {
  constructor() {
    super("The job does not exist in this workspace.");
    this.name = "JobNotFoundError";
  }
}

export type TriggerRunStatus = string;

export interface TriggerJobClient {
  tasks: {
    trigger(taskIdentifier: string, payload: unknown): Promise<Readonly<{ id: string }>>;
  };
  runs: {
    retrieve(runId: string): Promise<Readonly<{ id: string; status: TriggerRunStatus }>>;
    cancel(runId: string): Promise<Readonly<{ id: string }>>;
  };
}

/**
 * Trigger.dev-backed implementation of the deliberately narrow JobRunner
 * contract. Task payloads explicitly carry workspace identity, while this
 * adapter retains a workspace-scoped run map before any remote lookup/cancel.
 */
export class TriggerJobRunner implements JobRunner {
  private readonly jobs = new Map<string, Job>();

  constructor(private readonly client: TriggerJobClient) {}

  async enqueue(input: JobInput): Promise<Job> {
    const run = await this.client.tasks.trigger(input.type, {
      workspaceId: input.workspaceId,
      input: input.input,
    });
    const job: Job = {
      id: run.id,
      workspaceId: input.workspaceId,
      type: input.type,
      input: input.input,
      status: "queued",
    };

    this.jobs.set(job.id, job);
    return job;
  }

  async status(input: JobStatusQuery): Promise<Job | undefined> {
    const job = this.workspaceJob(input);
    if (job === undefined) {
      return undefined;
    }

    if (job.status === "cancelled") {
      return job;
    }

    const run = await this.client.runs.retrieve(job.id);
    return { ...job, status: this.toJobStatus(run.status) };
  }

  async cancel(input: JobStatusQuery): Promise<Job> {
    const job = this.workspaceJob(input);
    if (job === undefined) {
      throw new JobNotFoundError();
    }

    if (job.status === "cancelled") {
      return job;
    }

    await this.client.runs.cancel(job.id);
    const cancelledJob: Job = { ...job, status: "cancelled" };
    this.jobs.set(cancelledJob.id, cancelledJob);
    return cancelledJob;
  }

  private workspaceJob(input: JobStatusQuery): Job | undefined {
    const job = this.jobs.get(input.jobId);
    return job?.workspaceId === input.workspaceId ? job : undefined;
  }

  private toJobStatus(status: TriggerRunStatus): JobStatus {
    switch (status) {
      case "COMPLETED":
        return "completed";
      case "FAILED":
      case "CRASHED":
      case "SYSTEM_FAILURE":
        return "failed";
      case "CANCELED":
      case "CANCELLED":
        return "cancelled";
      case "EXECUTING":
      case "RUNNING":
      case "REATTEMPTING":
        return "running";
      default:
        return "queued";
    }
  }
}

export type TriggerWorkflowOptions = Readonly<{
  idempotencyKey?: string;
  queue?: string;
  delay?: string;
}>;

export type TriggerWorkflowRequest = Readonly<{
  taskIdentifier: string;
  payload: unknown;
  options: TriggerWorkflowOptions;
}>;

export interface TriggerWorkflowAdapterClient {
  tasks: {
    trigger(
      taskIdentifier: string,
      payload: unknown,
      options: TriggerWorkflowOptions,
    ): Promise<Readonly<{ id: string }>>;
  };
}

/**
 * Explicit Trigger.dev-only access to queue, delay, and idempotency options.
 * Progress, retry, and task workflow details remain provider semantics, rather
 * than becoming members of the portable JobRunner contract.
 */
export class TriggerWorkflowClient {
  constructor(private readonly client: TriggerWorkflowAdapterClient) {}

  async triggerWorkflow(input: TriggerWorkflowRequest): Promise<Readonly<{ id: string }>> {
    return this.client.tasks.trigger(input.taskIdentifier, input.payload, input.options);
  }
}

/**
 * A deterministic local queue. It does not execute handlers or model workflow,
 * progress, retry, or scheduling behavior owned by a concrete runtime.
 */
export class LocalJobRunner implements JobRunner {
  private nextJobId = 1;
  private readonly jobs = new Map<string, Job>();

  async enqueue(input: JobInput): Promise<Job> {
    const job: Job = {
      id: `job_${this.nextJobId++}`,
      workspaceId: input.workspaceId,
      type: input.type,
      input: input.input,
      status: "queued",
    };

    this.jobs.set(job.id, job);
    return job;
  }

  async status(input: JobStatusQuery): Promise<Job | undefined> {
    const job = this.jobs.get(input.jobId);
    if (job?.workspaceId !== input.workspaceId) {
      return undefined;
    }

    return job;
  }

  async cancel(input: JobStatusQuery): Promise<Job> {
    const job = await this.status(input);
    if (job === undefined) {
      throw new JobNotFoundError();
    }

    if (job.status === "cancelled") {
      return job;
    }

    const cancelledJob: Job = { ...job, status: "cancelled" };
    this.jobs.set(cancelledJob.id, cancelledJob);
    return cancelledJob;
  }
}

export {
  countCronRuns,
  isAtLeastHourlyCron,
  LocalJobScheduler,
  MAX_MISSED_RUN_COUNT,
  nextCronRun,
  parseCronExpression,
  ScheduleNotFoundError,
  type ClaimedCronSchedule,
  type CronSchedule,
  type JobScheduler,
  type ScheduleInput,
} from "./scheduler";

export {
  createDrizzleJobScheduler,
  MAX_CLAIM_LIMIT,
  MAX_WORKSPACE_SCHEDULES,
  WORKSPACE_CLAIM_LIMIT,
  WorkspaceScheduleLimitError,
  type ClaimDueSchedulesInput,
  type DrizzleJobScheduler,
  type DrizzleScheduleInput,
} from "./drizzle-scheduler";
