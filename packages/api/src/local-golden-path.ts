export type GoldenPathModelRequirements = Readonly<{
  minContext?: number;
  structuredOutput?: boolean;
  tools?: boolean;
  vision?: boolean;
}>;

type WorkspaceRecords = Readonly<{
  membership: Readonly<{ role: string; workspaceId: string }>;
  workspace: Readonly<{ id: string; type: string }>;
}>;

type Session = Readonly<{
  email: string;
  token: string;
  userId: string;
  workspaceId: string;
}>;

type TaskStatus = "queued" | "running" | "completed" | "failed";

type GoldenPathTask = {
  readonly alias: "fast" | "smart" | "cheap";
  readonly email: string;
  readonly id: string;
  readonly input: unknown;
  readonly requirements: GoldenPathModelRequirements;
  result?: unknown;
  status: TaskStatus;
  readonly workspaceId: string;
};

export class GoldenPathAuthorizationError extends Error {
  constructor() {
    super("The session cannot access this workspace resource.");
    this.name = "GoldenPathAuthorizationError";
  }
}

export class GoldenPathEntitlementError extends Error {
  constructor() {
    super("An active AI entitlement is required.");
    this.name = "GoldenPathEntitlementError";
  }
}

export class GoldenPathOtpError extends Error {
  constructor() {
    super("The local email OTP is missing or invalid.");
    this.name = "GoldenPathOtpError";
  }
}

export interface LocalGoldenPathDependencies {
  readonly ai: {
    complete(
      input: Readonly<{
        alias: "fast" | "smart" | "cheap";
        input: unknown;
        requirements: GoldenPathModelRequirements;
        workspace: Readonly<{
          budget: null;
          keyMode: "platform";
          workspaceId: string;
        }>;
      }>,
    ): Promise<unknown>;
  };
  readonly billing: {
    grantEntitlement(input: Readonly<{ key: string; workspaceId: string }>): unknown;
    hasEntitlement(input: Readonly<{ key: string; workspaceId: string }>): boolean;
  };
  readonly createId: (kind: string) => string;
  readonly createPersonalWorkspaceRecords: (
    input: Readonly<{
      createId: (kind: "invitation" | "membership" | "workspace") => string;
      now: () => Date;
      userId: string;
      userName?: string | null | undefined;
    }>,
  ) => WorkspaceRecords;
  readonly email: {
    send(
      input: Readonly<{
        category: "transactional";
        subject: string;
        text: string;
        to: string;
        workspaceId: string;
      }>,
    ): Promise<Readonly<{ id: string }>>;
  };
  readonly jobs: {
    enqueue(
      input: Readonly<{
        input: unknown;
        type: string;
        workspaceId: string;
      }>,
    ): Promise<Readonly<{ id: string }>>;
  };
  readonly now: () => Date;
  readonly otp: string;
}

export class LocalGoldenPath {
  private readonly pendingOtps = new Map<string, string>();
  private readonly sessions = new Map<string, Session>();
  private readonly tasks = new Map<string, GoldenPathTask>();

  constructor(private readonly dependencies: LocalGoldenPathDependencies) {}

  async requestEmailOtp(input: Readonly<{ email: string }>) {
    const email = normalizeEmail(input.email);
    this.pendingOtps.set(email, this.dependencies.otp);
    const delivery = await this.dependencies.email.send({
      category: "transactional",
      subject: "Your supastack sign-in code",
      text: `Your local sign-in code is ${this.dependencies.otp}`,
      to: email,
      workspaceId: "auth",
    });

    return Object.freeze({
      deliveryId: delivery.id,
      developmentOtp: this.dependencies.otp,
    });
  }

  async verifyEmailOtp(input: Readonly<{ email: string; name?: string; otp: string }>) {
    const email = normalizeEmail(input.email);
    if (this.pendingOtps.get(email) !== input.otp) {
      throw new GoldenPathOtpError();
    }

    this.pendingOtps.delete(email);
    const userId = this.dependencies.createId("user");
    const records = this.dependencies.createPersonalWorkspaceRecords({
      createId: (kind) => this.dependencies.createId(kind),
      now: this.dependencies.now,
      userId,
      ...(input.name === undefined ? {} : { userName: input.name }),
    });
    const sessionToken = this.dependencies.createId("session");
    this.sessions.set(sessionToken, {
      email,
      token: sessionToken,
      userId,
      workspaceId: records.workspace.id,
    });

    return Object.freeze({
      membership: records.membership,
      sessionToken,
      workspace: records.workspace,
    });
  }

  grantLocalEntitlement(input: Readonly<{ key: string; sessionToken: string }>) {
    const session = this.requireSession(input.sessionToken);
    return this.dependencies.billing.grantEntitlement({
      key: input.key,
      workspaceId: session.workspaceId,
    });
  }

  async submitAiTask(
    input: Readonly<{
      alias: "fast" | "smart" | "cheap";
      input: unknown;
      requirements: GoldenPathModelRequirements;
      sessionToken: string;
    }>,
  ) {
    const session = this.requireSession(input.sessionToken);
    if (
      !this.dependencies.billing.hasEntitlement({
        key: "ai",
        workspaceId: session.workspaceId,
      })
    ) {
      throw new GoldenPathEntitlementError();
    }

    const job = await this.dependencies.jobs.enqueue({
      input: {
        alias: input.alias,
        input: input.input,
        requirements: input.requirements,
      },
      type: "ai.generate",
      workspaceId: session.workspaceId,
    });
    const task: GoldenPathTask = {
      alias: input.alias,
      email: session.email,
      id: job.id,
      input: input.input,
      requirements: input.requirements,
      status: "queued",
      workspaceId: session.workspaceId,
    };
    this.tasks.set(task.id, task);

    return this.snapshotTask(task);
  }

  async runTask(taskId: string) {
    const task = this.tasks.get(taskId);
    if (task === undefined) {
      throw new GoldenPathAuthorizationError();
    }

    task.status = "running";
    try {
      task.result = await this.dependencies.ai.complete({
        alias: task.alias,
        input: task.input,
        requirements: task.requirements,
        workspace: {
          budget: null,
          keyMode: "platform",
          workspaceId: task.workspaceId,
        },
      });
      task.status = "completed";
      const completionEmail = await this.dependencies.email.send({
        category: "transactional",
        subject: "Your AI task is complete",
        text: `Task ${task.id} completed successfully.`,
        to: task.email,
        workspaceId: task.workspaceId,
      });

      return Object.freeze({
        completionEmailId: completionEmail.id,
        status: task.status,
      });
    } catch (error) {
      task.status = "failed";
      throw error;
    }
  }

  getTask(input: Readonly<{ sessionToken: string; taskId: string }>) {
    const session = this.requireSession(input.sessionToken);
    const task = this.tasks.get(input.taskId);
    if (task === undefined || task.workspaceId !== session.workspaceId) {
      throw new GoldenPathAuthorizationError();
    }

    return this.snapshotTask(task);
  }

  private requireSession(token: string): Session {
    const session = this.sessions.get(token);
    if (session === undefined) {
      throw new GoldenPathAuthorizationError();
    }
    return session;
  }

  private snapshotTask(task: GoldenPathTask) {
    return Object.freeze({ ...task });
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
