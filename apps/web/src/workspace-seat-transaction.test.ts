import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateInviteResend } from "@supastack/db";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import {
  canAcceptWorkspaceSeatReservation,
  evaluateWorkspaceSeatLimit,
  workspaceSeatLimitForPriceReference,
} from "./workspace-invite.js";
import { withWorkspaceSeatTransaction } from "./workspace-seat-transaction.js";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");

function readWeb(relativePath: string): string {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

function findWorkspaceSeatCallback(sourceText: string, operationName: string): string {
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
  expect(callbackBody, `${operationName} must use the shared seat transaction`).toBeDefined();
  return callbackBody ?? "";
}

function createLockingDatabase() {
  const queueByKey = new Map<string, Promise<void>>();
  const statements: { params: unknown[]; sql: string }[] = [];

  const database = {
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
            expect(typeof key).toBe("string");
            statements.push({ params: statement.params, sql: statement.sql });

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

  return { database, statements };
}

describe("workspace seat transaction lock", () => {
  it("serializes concurrent reservations at the final seat using the SQL lock", async () => {
    const { database, statements } = createLockingDatabase();
    const seats = { members: 4, pendingInvites: 0 };

    async function reserveInvite(email: string) {
      return withWorkspaceSeatTransaction(database, "ws_1", async () => {
        const decision = evaluateWorkspaceSeatLimit({
          memberCount: seats.members,
          pendingInviteCount: seats.pendingInvites,
          seatLimit: 5,
        });
        await Promise.resolve();
        if (!decision.allowed) return { email, reserved: false };
        seats.pendingInvites += 1;
        return { email, reserved: true };
      });
    }

    const results = await Promise.all([
      reserveInvite("first@example.test"),
      reserveInvite("second@example.test"),
    ]);

    expect(results.filter((result) => result.reserved)).toHaveLength(1);
    expect(seats).toEqual({ members: 4, pendingInvites: 1 });
    expect(statements).toHaveLength(2);
    expect(statements.map((entry) => entry.params)).toEqual([
      ["workspace-seats:ws_1"],
      ["workspace-seats:ws_1"],
    ]);
  });

  it("does not serialize transactions belonging to different workspaces", async () => {
    const { database, statements } = createLockingDatabase();
    let active = 0;
    let maximumActive = 0;
    let bothEntered!: () => void;
    const together = new Promise<void>((resolve) => {
      bothEntered = resolve;
    });

    async function enter(workspaceId: string) {
      return withWorkspaceSeatTransaction(database, workspaceId, async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        if (active === 2) bothEntered();
        await Promise.race([together, new Promise<void>((resolve) => setTimeout(resolve, 50))]);
        active -= 1;
      });
    }

    await Promise.all([enter("ws_1"), enter("ws_2")]);

    expect(maximumActive).toBe(2);
    expect(statements.map((entry) => entry.params)).toEqual([
      ["workspace-seats:ws_1"],
      ["workspace-seats:ws_2"],
    ]);
  });

  it("consumes a live reservation at the cap once and rejects over-limit legacy acceptance", async () => {
    const { database } = createLockingDatabase();
    const seats = { members: 4, pendingInvites: 1 };
    let invitationPending = true;

    async function acceptInvite() {
      return withWorkspaceSeatTransaction(database, "ws_1", async () => {
        if (!invitationPending) return false;
        const allowed = canAcceptWorkspaceSeatReservation({
          memberCount: seats.members,
          pendingInviteCount: seats.pendingInvites,
          seatLimit: 5,
        });
        if (!allowed) return false;
        invitationPending = false;
        seats.pendingInvites -= 1;
        seats.members += 1;
        return true;
      });
    }

    const accepted = await Promise.all([acceptInvite(), acceptInvite()]);
    expect(accepted.filter(Boolean)).toHaveLength(1);
    expect(accepted.filter((result) => !result)).toHaveLength(1);
    expect(seats).toEqual({ members: 5, pendingInvites: 0 });
    expect(
      canAcceptWorkspaceSeatReservation({
        memberCount: 5,
        pendingInviteCount: 1,
        seatLimit: 5,
      }),
    ).toBe(false);
    expect(
      canAcceptWorkspaceSeatReservation({
        memberCount: 5,
        pendingInviteCount: 1,
        seatLimit: null,
      }),
    ).toBe(true);
  });

  it("does not let an expired resend and a new invite claim the same final seat", async () => {
    const { database } = createLockingDatabase();
    const seats = { members: 4, pendingInvites: 0 };
    let expiredInvite = true;

    async function reserveSeat(kind: "create" | "expired-resend") {
      return withWorkspaceSeatTransaction(database, "ws_1", async () => {
        if (kind === "expired-resend") {
          const resend = evaluateInviteResend({
            expiresAt: new Date("2026-09-01T00:00:00.000Z"),
            now: new Date("2026-09-02T00:00:00.000Z"),
            status: expiredInvite ? "pending" : "accepted",
          });
          if (!resend.ok || !resend.rotateToken) return false;
        }

        const decision = evaluateWorkspaceSeatLimit({
          memberCount: seats.members,
          pendingInviteCount: seats.pendingInvites,
          seatLimit: 5,
        });
        await Promise.resolve();
        if (!decision.allowed) return false;
        seats.pendingInvites += 1;
        if (kind === "expired-resend") expiredInvite = false;
        return true;
      });
    }

    const [newInvite, expiredResend] = await Promise.all([
      reserveSeat("create"),
      reserveSeat("expired-resend"),
    ]);

    expect([newInvite, expiredResend].filter(Boolean)).toHaveLength(1);
    expect(seats).toEqual({ members: 4, pendingInvites: 1 });
  });

  it("leaves an over-limit legacy invitation pending when acceptance is denied", async () => {
    const { database } = createLockingDatabase();
    const seats = { members: 4, pendingInvites: 2 };
    let invitationPending = true;

    const accepted = await withWorkspaceSeatTransaction(database, "ws_1", async () => {
      if (!invitationPending) return false;
      const allowed = canAcceptWorkspaceSeatReservation({
        memberCount: seats.members,
        pendingInviteCount: seats.pendingInvites,
        seatLimit: 5,
      });
      if (!allowed) return false;
      invitationPending = false;
      seats.pendingInvites -= 1;
      seats.members += 1;
      return true;
    });

    expect(accepted).toBe(false);
    expect(invitationPending).toBe(true);
    expect(seats).toEqual({ members: 4, pendingInvites: 2 });
  });

  it("maps plan price references to the shared seat ceilings", () => {
    expect(workspaceSeatLimitForPriceReference(undefined)).toBe(1);
    expect(workspaceSeatLimitForPriceReference("pro_monthly")).toBe(5);
    expect(workspaceSeatLimitForPriceReference("business_monthly")).toBe(20);
    expect(workspaceSeatLimitForPriceReference("enterprise_monthly")).toBeNull();
  });
});

describe("web and mobile invitation quota paths", () => {
  it("keeps seat counts and their reservation transitions inside each shared transaction", () => {
    const web = readWeb("src/organization-actions.ts");
    const mobile = readWeb("src/mobile-organization.ts");

    const contracts: ReadonlyArray<{
      operationName: string;
      source: string;
      terms: readonly string[];
    }> = [
      {
        operationName: "createWorkspaceInviteAction",
        source: web,
        terms: ["memberCountRow", "pendingInviteRow", ".insert(workspaceInvitation)"],
      },
      {
        operationName: "acceptWorkspaceInviteAction",
        source: web,
        terms: [
          "memberCountRow",
          "pendingInviteRow",
          "canAcceptWorkspaceSeatReservation",
          ".insert(workspaceMembership)",
          ".update(workspaceInvitation)",
        ],
      },
      {
        operationName: "resendWorkspaceInviteAction",
        source: web,
        terms: ["memberCountRow", "pendingInviteRow", ".update(workspaceInvitation)"],
      },
      {
        operationName: "createInvite",
        source: mobile,
        terms: ["memberCountRow", "pendingInviteRow", ".insert(workspaceInvitation)"],
      },
      {
        operationName: "acceptInvite",
        source: mobile,
        terms: [
          "memberCountRow",
          "pendingInviteRow",
          "canAcceptWorkspaceSeatReservation",
          ".insert(workspaceMembership)",
          ".update(workspaceInvitation)",
        ],
      },
      {
        operationName: "resendInvite",
        source: mobile,
        terms: ["memberCountRow", "pendingInviteRow", ".update(workspaceInvitation)"],
      },
    ];

    for (const contract of contracts) {
      const callback = findWorkspaceSeatCallback(contract.source, contract.operationName);
      for (const term of contract.terms) {
        expect(callback, `${contract.operationName} callback must contain ${term}`).toContain(term);
      }
    }
  });

  it("keeps subscription lookup alongside the locked seat counts", () => {
    const web = readWeb("src/organization-actions.ts");
    const mobile = readWeb("src/mobile-organization.ts");
    const paths: ReadonlyArray<readonly [string, string]> = [
      [web, "createWorkspaceInviteAction"],
      [web, "acceptWorkspaceInviteAction"],
      [web, "resendWorkspaceInviteAction"],
      [mobile, "createInvite"],
      [mobile, "acceptInvite"],
      [mobile, "resendInvite"],
    ];
    for (const [source, operationName] of paths) {
      const callback = findWorkspaceSeatCallback(source, operationName);
      expect(callback, operationName).toContain("activeSubscription");
      expect(callback, operationName).toContain("workspaceSeatLimitForPriceReference");
    }
  });
});
