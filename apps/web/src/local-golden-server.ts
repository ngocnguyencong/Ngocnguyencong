import { FakeAiProvider, ModelRouter, createModelPrice } from "@supastack/ai";
import { LocalGoldenPath } from "@supastack/api";
import { LocalBillingService } from "@supastack/billing";
import { createPersonalWorkspaceRecords } from "@supastack/db";
import { LocalOutboxEmailSender } from "@supastack/email";
import { LocalJobRunner } from "@supastack/jobs";

type LocalReferenceWorkspace = Readonly<{
  id: string;
  name: string;
  workspaceId: string;
}>;

type LocalReferenceTask = Readonly<{
  id: string;
  prompt: string;
  result: string | null;
  status: "queued" | "completed";
  workspaceId: string;
}>;

type LocalReferenceCompletionEmail = Readonly<{
  category: "transactional";
  id: string;
  status: "queued";
  workspaceId: string;
}>;

type LocalReferenceSession = Readonly<{
  name: string;
  taskId?: string;
  workspace: LocalReferenceWorkspace;
}>;

const completionEmailIds = new Map<string, string>();
const sessions = new Map<string, LocalReferenceSession>();
const outbox = new LocalOutboxEmailSender();
const goldenPath = createLocalGoldenPath();

export async function authenticateLocalReferenceUser(
  input: Readonly<{
    email: string;
    name: string;
  }>,
): Promise<
  Readonly<{
    entitlement: LocalReferenceEntitlement;
    sessionToken: string;
    workspace: LocalReferenceWorkspace;
  }>
> {
  const email = input.email.trim();
  const name = input.name.trim() || "Local user";

  if (email.length === 0) {
    throw new Error("Enter an email address to start the local reference flow.");
  }

  const otp = await goldenPath.requestEmailOtp({ email });
  const authenticated = await goldenPath.verifyEmailOtp({
    email,
    name,
    otp: otp.developmentOtp,
  });
  const workspace: LocalReferenceWorkspace = {
    id: authenticated.workspace.id,
    name: `${name}'s workspace`,
    workspaceId: authenticated.workspace.id,
  };

  goldenPath.grantLocalEntitlement({ key: "ai", sessionToken: authenticated.sessionToken });
  sessions.set(authenticated.sessionToken, { name, workspace });

  return Object.freeze({
    entitlement: localReferenceEntitlement(workspace.workspaceId),
    sessionToken: authenticated.sessionToken,
    workspace,
  });
}

export async function enqueueLocalReferenceTask(
  input: Readonly<{
    prompt: string;
    sessionToken: string;
  }>,
): Promise<LocalReferenceTask> {
  const prompt = input.prompt.trim();
  const session = requireSession(input.sessionToken);

  if (prompt.length === 0) {
    throw new Error("Describe the local task before placing it in the queue.");
  }

  const task = await goldenPath.submitAiTask({
    alias: "smart",
    input: { prompt },
    requirements: { minContext: 32_000, structuredOutput: true },
    sessionToken: input.sessionToken,
  });

  if (task.workspaceId !== session.workspace.workspaceId) {
    throw new Error("The local task is outside the current workspace.");
  }

  sessions.set(input.sessionToken, { ...session, taskId: task.id });

  return toReferenceTask(task);
}

export async function hydrateLocalReferenceSession(
  input: Readonly<{ sessionToken: string }>,
): Promise<
  Readonly<{
    entitlement: LocalReferenceEntitlement;
    task:
      | (LocalReferenceTask & Readonly<{ completionEmail: LocalReferenceCompletionEmail | null }>)
      | null;
    workspace: LocalReferenceWorkspace;
  }>
> {
  const session = requireSession(input.sessionToken);
  const task =
    session.taskId === undefined
      ? null
      : await getLocalReferenceTask({
          sessionToken: input.sessionToken,
          taskId: session.taskId,
        });

  return Object.freeze({
    entitlement: localReferenceEntitlement(session.workspace.workspaceId),
    task,
    workspace: session.workspace,
  });
}

export async function runLocalReferenceTask(
  input: Readonly<{
    sessionToken: string;
    taskId: string;
  }>,
): Promise<LocalReferenceTask & Readonly<{ completionEmail: LocalReferenceCompletionEmail }>> {
  const task = goldenPath.getTask(input);
  const session = requireSession(input.sessionToken);

  if (task.workspaceId !== session.workspace.workspaceId) {
    throw new Error("The local task is outside the current workspace.");
  }

  if (task.status !== "queued") {
    throw new Error("Queue a local task before completing it.");
  }

  const completion = await goldenPath.runTask(input.taskId);
  completionEmailIds.set(input.taskId, completion.completionEmailId);

  const completedTask = toReferenceTask(goldenPath.getTask(input));
  const completionEmail = await getCompletionEmail({
    deliveryId: completion.completionEmailId,
    workspaceId: completedTask.workspaceId,
  });

  if (completionEmail === null) {
    throw new Error("The local transactional completion email was not recorded.");
  }

  return Object.freeze({ ...completedTask, completionEmail });
}

export async function getLocalReferenceTask(
  input: Readonly<{
    sessionToken: string;
    taskId: string;
  }>,
): Promise<
  LocalReferenceTask & Readonly<{ completionEmail: LocalReferenceCompletionEmail | null }>
> {
  const task = goldenPath.getTask(input);
  const referenceTask = toReferenceTask(task);
  const completionEmailId = completionEmailIds.get(input.taskId);
  const completionEmail =
    completionEmailId === undefined
      ? null
      : await getCompletionEmail({
          deliveryId: completionEmailId,
          workspaceId: referenceTask.workspaceId,
        });

  return Object.freeze({ ...referenceTask, completionEmail });
}

function createLocalGoldenPath(): LocalGoldenPath {
  const provider = new FakeAiProvider("fake");
  const router = new ModelRouter({
    models: [
      {
        capabilities: {
          maxContext: 128_000,
          structuredOutput: true,
          tools: true,
          vision: false,
        },
        id: "fake-smart",
        model: "fake-smart",
        modelVersion: "1",
        price: createModelPrice({
          cachedInputMicrounitsPerMillionTokens: 100_000n,
          currency: "USD",
          effectiveFrom: "2026-09-03T00:00:00.000Z",
          inputMicrounitsPerMillionTokens: 1_000_000n,
          model: "fake-smart",
          modelVersion: "1",
          outputMicrounitsPerMillionTokens: 2_000_000n,
          priceId: "fake-smart:1:2026-09-03",
          provider: "fake",
        }),
        provider: "fake",
        ranking: { cheap: 1, fast: 1, smart: 1 },
      },
    ],
    providers: [provider],
  });

  return new LocalGoldenPath({
    ai: router,
    billing: new LocalBillingService(),
    createId: createLocalId,
    createPersonalWorkspaceRecords,
    email: outbox,
    jobs: new LocalJobRunner(),
    now: () => new Date(),
    otp: "123456",
  });
}

function createLocalId(kind: string): string {
  return `${kind}_${crypto.randomUUID()}`;
}

type LocalReferenceEntitlement = Readonly<{
  key: "reference-ai";
  state: "active";
  workspaceId: string;
}>;

function localReferenceEntitlement(workspaceId: string): LocalReferenceEntitlement {
  return Object.freeze({ key: "reference-ai" as const, state: "active" as const, workspaceId });
}

function requireSession(sessionToken: string): LocalReferenceSession {
  const session = sessions.get(sessionToken);

  if (session === undefined) {
    throw new Error("The local reference session is not available.");
  }

  return session;
}

async function getCompletionEmail(
  input: Readonly<{
    deliveryId: string;
    workspaceId: string;
  }>,
): Promise<LocalReferenceCompletionEmail | null> {
  const delivery = await outbox.getStatus(input);

  return delivery === undefined
    ? null
    : Object.freeze({
        category: "transactional" as const,
        id: delivery.id,
        status: delivery.status,
        workspaceId: delivery.workspaceId,
      });
}

function toReferenceTask(
  task: Readonly<{
    id: string;
    input: unknown;
    result?: unknown;
    status: "queued" | "running" | "completed" | "failed";
    workspaceId: string;
  }>,
): LocalReferenceTask {
  if (task.status !== "queued" && task.status !== "completed") {
    throw new Error(`Unexpected local task status: ${task.status}`);
  }

  return Object.freeze({
    id: task.id,
    prompt: promptFromTaskInput(task.input),
    result: textFromTaskResult(task.result),
    status: task.status,
    workspaceId: task.workspaceId,
  });
}

function promptFromTaskInput(input: unknown): string {
  if (
    typeof input === "object" &&
    input !== null &&
    "prompt" in input &&
    typeof input.prompt === "string"
  ) {
    return input.prompt;
  }

  throw new Error("The local task prompt is unavailable.");
}

function textFromTaskResult(result: unknown): string | null {
  if (result === undefined) {
    return null;
  }

  if (
    typeof result === "object" &&
    result !== null &&
    "text" in result &&
    typeof result.text === "string"
  ) {
    return result.text;
  }

  throw new Error("The local AI result is unavailable.");
}
