import { NextResponse } from "next/server";

import { getAuthSession } from "../../../../src/auth-runtime";
import { resolveChatScope } from "../../../../src/chat-api";
import { getWorkspaceCredits, listWorkspaceCreditTransactions } from "../../../../src/credits";

export const runtime = "nodejs";

/** Prepaid credit balance + recent ledger entries for the caller's workspace. */
export async function GET(request: Request) {
  const session = await getAuthSession(request.headers);
  if (session === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const scope = await resolveChatScope(session.user.id);
  if (scope === null) {
    return NextResponse.json({ error: "No workspace" }, { status: 403 });
  }

  const [balance, transactions] = await Promise.all([
    getWorkspaceCredits(scope.workspaceId),
    listWorkspaceCreditTransactions(scope.workspaceId, 50),
  ]);

  return NextResponse.json(
    {
      balance,
      transactions: transactions.map((transaction) => ({
        amount: transaction.amount,
        balanceAfter: transaction.balanceAfter,
        createdAt: transaction.createdAt.toISOString(),
        id: transaction.id,
        kind: transaction.kind,
        reason: transaction.reason,
        // referenceId stays server-side — grant refs embed provider
        // subscription ids that members don't need.
      })),
    },
    { status: 200 },
  );
}
