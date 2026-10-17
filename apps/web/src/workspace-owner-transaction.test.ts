import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  evaluateLeaveOrganization,
  evaluateMemberRemoval,
  evaluateMemberRoleUpdate,
  type WorkspaceRole,
} from "@supastack/db";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { withWorkspaceSeatTransaction } from "./workspace-seat-transaction.js";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");

function readWeb(relativePath: string): string {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

function findWorkspaceMutationCallback(sourceText: string, operationName: string): string {
  const sourceFile = ts.createSourceFile(
    `${operationName}.ts`,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let callbackBody: string | undefined;

  function visit(node: ts.Node): void {
    if (
      (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) &&
      node.name !== undefined &&
      node.name.getText(sourceFile) === operationName &&
      node.body !== undefined
    ) {
      const findCall = (child: ts.Node): void => {
        if (
          ts.isCallExpression(child) &&
          ts.isIdentifier(child.expression) &&
          child.expression.text === "withWorkspaceSeatTransaction"
        ) {
          const callback = child.arguments[2];
          if (callback !== undefined && ts.isArrowFunction(callback) && ts.isBlock(callback.body)) {
            callbackBody = callback.body.getText(sourceFile);
          }
        }
        ts.forEachChild(child, findCall);
      };
      findCall(node.body);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  expect(callbackBody, `${operationName} must use the shared workspace transaction`).toBeDefined();
  return callbackBody ?? "";
}

function createLockingDatabase() {
  const queueByKey = new Map<string, Promise<void>>();

  return {
    async transaction<Result>(
      operation: (transaction: { execute(query: SQL): Promise<void> }) => Promise<Result>,
    ): Promise<Result> {
      let releaseLock: (() => void) | undefined;
      try {
        return await operation({
          async execute(query) {
            const statement = new PgDialect().sqlToQuery(query);
            expect(statement.sql).toBe("select pg_advisory_xact_lock(hashtextextended($1, 0))");
            const [key] = statement.params;
            const lockKey = String(key);
            const previous = queueByKey.get(lockKey) ?? Promise.resolve();
            let unlock!: () => void;
            const current = new Promise<void>((resolve) => {
              unlock = resolve;
            });
            queueByKey.set(lockKey, current);
            await previous;
            releaseLock = () => {
              unlock();
              if (queueByKey.get(lockKey) === current) queueByKey.delete(lockKey);
            };
          },
        });
      } finally {
        releaseLock?.();
      }
    },
  };
}

type Member = { role: WorkspaceRole };

function countOwners(members: Map<string, Member>): number {
  return [...members.values()].filter((member) => member.role === "owner").length;
}

describe("workspace owner transaction lock", () => {
  it("serializes concurrent demotions and rereads the actor role after locking", async () => {
    const database = createLockingDatabase();
    const members = new Map<string, Member>([
      ["owner-a", { role: "owner" }],
      ["owner-b", { role: "owner" }],
    ]);

    async function demote(actorId: string, targetId: string) {
      return withWorkspaceSeatTransaction(database, "ws_owners", async () => {
        const actorRole = members.get(actorId)?.role;
        const targetRole = members.get(targetId)?.role;
        if (actorRole === undefined || targetRole === undefined) return false;
        const decision = evaluateMemberRoleUpdate({
          actorRole,
          nextRole: "admin",
          ownerCount: countOwners(members),
          targetIsSelf: actorId === targetId,
          targetRole,
        });
        await Promise.resolve();
        if (!decision.ok) return false;
        members.set(targetId, { role: "admin" });
        return true;
      });
    }

    const results = await Promise.all([demote("owner-a", "owner-b"), demote("owner-b", "owner-a")]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(countOwners(members)).toBe(1);
  });

  it("serializes concurrent removals of two owners", async () => {
    const database = createLockingDatabase();
    const members = new Map<string, Member>([
      ["owner-a", { role: "owner" }],
      ["owner-b", { role: "owner" }],
    ]);

    async function remove(actorId: string, targetId: string) {
      return withWorkspaceSeatTransaction(database, "ws_owners", async () => {
        const actorRole = members.get(actorId)?.role;
        const targetRole = members.get(targetId)?.role;
        if (actorRole === undefined || targetRole === undefined) return false;
        const decision = evaluateMemberRemoval({
          actorRole,
          ownerCount: countOwners(members),
          targetIsSelf: actorId === targetId,
          targetRole,
        });
        await Promise.resolve();
        if (!decision.ok) return false;
        members.delete(targetId);
        return true;
      });
    }

    const results = await Promise.all([remove("owner-a", "owner-b"), remove("owner-b", "owner-a")]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(countOwners(members)).toBe(1);
  });

  it("allows only one of two concurrent owners to leave", async () => {
    const database = createLockingDatabase();
    const members = new Map<string, Member>([
      ["owner-a", { role: "owner" }],
      ["owner-b", { role: "owner" }],
    ]);

    async function leave(actorId: string) {
      return withWorkspaceSeatTransaction(database, "ws_owners", async () => {
        const actorRole = members.get(actorId)?.role;
        if (actorRole === undefined) return false;
        const decision = evaluateLeaveOrganization({
          actorRole,
          ownerCount: countOwners(members),
          workspaceType: "organization",
        });
        await Promise.resolve();
        if (!decision.ok) return false;
        members.delete(actorId);
        return true;
      });
    }

    const results = await Promise.all([leave("owner-a"), leave("owner-b")]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(countOwners(members)).toBe(1);
  });
});

describe("web and mobile owner mutations", () => {
  it("keeps actor, target, owner-count checks and role writes in the locked callback", () => {
    const web = readWeb("src/organization-actions.ts");
    const mobile = readWeb("src/mobile-organization.ts");
    const paths: ReadonlyArray<readonly [string, string, readonly string[]]> = [
      [
        web,
        "updateMemberRoleAction",
        ["actor", "ownerCountRow", "evaluateMemberRoleUpdate", ".update(workspaceMembership)"],
      ],
      [
        mobile,
        "updateRole",
        ["actor", "ownerCountRow", "evaluateMemberRoleUpdate", ".update(workspaceMembership)"],
      ],
    ];

    for (const [source, operationName, terms] of paths) {
      const callback = findWorkspaceMutationCallback(source, operationName);
      for (const term of terms) {
        expect(callback, `${operationName} callback must contain ${term}`).toContain(term);
      }
    }
  });

  it("keeps actor, target, owner-count checks and membership removals in the locked callback", () => {
    const web = readWeb("src/organization-actions.ts");
    const mobile = readWeb("src/mobile-organization.ts");
    const paths: ReadonlyArray<readonly [string, string, readonly string[]]> = [
      [
        web,
        "removeMemberAction",
        ["actor", "ownerCountRow", "evaluateMemberRemoval", ".delete(workspaceMembership)"],
      ],
      [
        mobile,
        "removeMember",
        ["actor", "ownerCountRow", "evaluateMemberRemoval", ".delete(workspaceMembership)"],
      ],
    ];

    for (const [source, operationName, terms] of paths) {
      const callback = findWorkspaceMutationCallback(source, operationName);
      for (const term of terms) {
        expect(callback, `${operationName} callback must contain ${term}`).toContain(term);
      }
    }
  });

  it("keeps owner-count checks and leave deletions in the locked callback", () => {
    const web = readWeb("src/organization-actions.ts");
    const mobile = readWeb("src/mobile-organization.ts");
    const paths: ReadonlyArray<readonly [string, string, readonly string[]]> = [
      [
        web,
        "leaveOrganizationAction",
        ["actor", "ownerCountRow", "evaluateLeaveOrganization", ".delete(workspaceMembership)"],
      ],
      [
        mobile,
        "leaveOrganization",
        ["actor", "ownerCountRow", "evaluateLeaveOrganization", ".delete(workspaceMembership)"],
      ],
    ];

    for (const [source, operationName, terms] of paths) {
      const callback = findWorkspaceMutationCallback(source, operationName);
      for (const term of terms) {
        expect(callback, `${operationName} callback must contain ${term}`).toContain(term);
      }
    }
  });
});
