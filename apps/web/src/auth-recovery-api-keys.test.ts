import { apiKey } from "@supastack/db";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import { createAuthRecoveryApiKeyRevoker } from "./auth-recovery-api-keys";

describe("mailbox recovery workspace API keys", () => {
  function setup(
    keys = [
      { id: "key-a", workspaceId: "workspace-a" },
      { id: "key-b", workspaceId: "workspace-b" },
    ],
  ) {
    const selection = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn(async (condition: unknown) => {
        void condition;
        return keys;
      }),
    };
    const mutation = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn(async (condition: unknown) => {
        void condition;
        return undefined;
      }),
    };
    const database = { select: vi.fn(() => selection), update: vi.fn(() => mutation) };
    return {
      selection,
      mutation,
      database,
      revoke: createAuthRecoveryApiKeyRevoker(database as never),
    };
  }

  it("revokes only active keys of the recovering user with a workspace predicate per mutation", async () => {
    const { revoke, database, selection, mutation } = setup();
    await revoke("recovering-user");
    expect(database.select).toHaveBeenCalledWith({
      id: apiKey.id,
      workspaceId: apiKey.workspaceId,
    });
    expect(selection.from).toHaveBeenCalledWith(apiKey);
    const dialect = new PgDialect();
    const selected = dialect.sqlToQuery(selection.where.mock.calls[0]![0] as never);
    expect(selected.params).toEqual(["recovering-user"]);
    expect(selected.sql).toContain('"api_key"."user_id" =');
    expect(selected.sql).toContain('"api_key"."revoked_at" is null');
    expect(database.update).toHaveBeenCalledTimes(2);
    for (const [index, key] of [
      { id: "key-a", workspaceId: "workspace-a" },
      { id: "key-b", workspaceId: "workspace-b" },
    ].entries()) {
      const updated = dialect.sqlToQuery(mutation.where.mock.calls[index]![0] as never);
      expect(updated.params).toEqual([key.id, "recovering-user", key.workspaceId]);
      expect(updated.sql).toContain('"api_key"."workspace_id" =');
      expect(updated.sql).toContain('"api_key"."revoked_at" is null');
      expect(mutation.set.mock.calls[index]![0]).toMatchObject({
        revokedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    }
  });

  it("does not mutate unrelated records when no keys belong to the recovering user", async () => {
    const { revoke, database } = setup([]);
    await revoke("recovering-user");
    expect(database.update).not.toHaveBeenCalled();
  });

  it("propagates database failure so recovery cannot continue past revocation", async () => {
    const { revoke, mutation } = setup();
    mutation.where.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(revoke("recovering-user")).rejects.toThrow("database unavailable");
  });
});
