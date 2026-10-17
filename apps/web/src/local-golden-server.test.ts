import { describe, expect, it } from "vitest";

type LocalGoldenServerModule = {
  authenticateLocalReferenceUser?: (
    input: Readonly<{
      email: string;
      name: string;
    }>,
  ) => Promise<
    Readonly<{
      entitlement: Readonly<{ key: string; state: string; workspaceId: string }>;
      sessionToken: string;
      workspace: Readonly<{ id: string; name: string; workspaceId: string }>;
    }>
  >;
  enqueueLocalReferenceTask?: (
    input: Readonly<{
      prompt: string;
      sessionToken: string;
    }>,
  ) => Promise<
    Readonly<{
      id: string;
      result: string | null;
      status: string;
      workspaceId: string;
    }>
  >;
  getLocalReferenceTask?: (
    input: Readonly<{
      sessionToken: string;
      taskId: string;
    }>,
  ) => Promise<
    Readonly<{
      completionEmail: Readonly<{
        category: "transactional";
        id: string;
        status: "queued";
        workspaceId: string;
      }> | null;
      id: string;
      result: string | null;
      status: string;
      workspaceId: string;
    }>
  >;
  hydrateLocalReferenceSession?: (input: Readonly<{ sessionToken: string }>) => Promise<
    Readonly<{
      entitlement: Readonly<{ key: "reference-ai"; state: "active"; workspaceId: string }>;
      task: Readonly<{
        completionEmail: Readonly<{
          category: "transactional";
          id: string;
          status: "queued";
          workspaceId: string;
        }> | null;
        id: string;
        result: string | null;
        status: "queued" | "completed";
        workspaceId: string;
      }> | null;
      workspace: Readonly<{ id: string; name: string; workspaceId: string }>;
    }>
  >;
  runLocalReferenceTask?: (
    input: Readonly<{
      sessionToken: string;
      taskId: string;
    }>,
  ) => Promise<
    Readonly<{
      completionEmail: Readonly<{
        category: "transactional";
        id: string;
        status: "queued";
        workspaceId: string;
      }>;
      id: string;
      result: string;
      status: "completed";
      workspaceId: string;
    }>
  >;
};

async function loadLocalGoldenServer(): Promise<LocalGoldenServerModule | null> {
  return import("./local-golden-server").catch(
    () => null,
  ) as Promise<LocalGoldenServerModule | null>;
}

describe("web local Golden Path server bridge", () => {
  it(
    "authenticates, entitles, runs, persists, and notifies in one workspace",
    // The golden-server import pulls the whole server graph; cold import
    // under the shared parallel run can exceed the 5s default.
    { timeout: 30_000 },
    async () => {
      const bridge = await loadLocalGoldenServer();
      expect(bridge?.authenticateLocalReferenceUser).toBeTypeOf("function");
      expect(bridge?.enqueueLocalReferenceTask).toBeTypeOf("function");
      expect(bridge?.getLocalReferenceTask).toBeTypeOf("function");
      expect(bridge?.hydrateLocalReferenceSession).toBeTypeOf("function");
      expect(bridge?.runLocalReferenceTask).toBeTypeOf("function");

      const authenticated = await bridge!.authenticateLocalReferenceUser!({
        email: "avery@example.test",
        name: "Avery",
      });

      expect(authenticated.workspace).toMatchObject({
        name: "Avery's workspace",
        workspaceId: authenticated.workspace.id,
      });
      expect(authenticated.entitlement).toEqual({
        key: "reference-ai",
        state: "active",
        workspaceId: authenticated.workspace.id,
      });

      const queued = await bridge!.enqueueLocalReferenceTask!({
        prompt: "Summarize the local acceptance criteria.",
        sessionToken: authenticated.sessionToken,
      });

      expect(queued).toMatchObject({
        result: null,
        status: "queued",
        workspaceId: authenticated.workspace.id,
      });

      const completed = await bridge!.runLocalReferenceTask!({
        sessionToken: authenticated.sessionToken,
        taskId: queued.id,
      });

      expect(completed).toMatchObject({
        completionEmail: {
          category: "transactional",
          status: "queued",
          workspaceId: authenticated.workspace.id,
        },
        result: expect.stringContaining("Summarize the local acceptance criteria."),
        status: "completed",
        workspaceId: authenticated.workspace.id,
      });

      await expect(
        bridge!.getLocalReferenceTask!({
          sessionToken: authenticated.sessionToken,
          taskId: queued.id,
        }),
      ).resolves.toMatchObject({
        completionEmail: completed.completionEmail,
        id: queued.id,
        result: completed.result,
        status: "completed",
        workspaceId: authenticated.workspace.id,
      });

      await expect(
        bridge!.hydrateLocalReferenceSession!({
          sessionToken: authenticated.sessionToken,
        }),
      ).resolves.toMatchObject({
        entitlement: authenticated.entitlement,
        task: {
          completionEmail: completed.completionEmail,
          id: queued.id,
          result: completed.result,
          status: "completed",
          workspaceId: authenticated.workspace.id,
        },
        workspace: authenticated.workspace,
      });
    },
  );

  it("does not send a second completion email for an already completed workspace task", async () => {
    const bridge = await loadLocalGoldenServer();
    const authenticated = await bridge!.authenticateLocalReferenceUser!({
      email: "single-run@example.test",
      name: "Single run",
    });
    const queued = await bridge!.enqueueLocalReferenceTask!({
      prompt: "Run this task once.",
      sessionToken: authenticated.sessionToken,
    });

    await bridge!.runLocalReferenceTask!({
      sessionToken: authenticated.sessionToken,
      taskId: queued.id,
    });

    await expect(
      bridge!.runLocalReferenceTask!({
        sessionToken: authenticated.sessionToken,
        taskId: queued.id,
      }),
    ).rejects.toThrow("Queue a local task before completing it.");
  });
});
