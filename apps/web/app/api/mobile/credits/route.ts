import { NextResponse } from "next/server";

import { getAuthSession } from "../../../../src/auth-runtime";
import { resolveMobileWorkspaceContext } from "../../../../src/mobile-workspace-context";
import { getWorkspaceCredits, listWorkspaceCreditTransactions } from "../../../../src/credits";

export const runtime = "nodejs";

/**
 * Mobile BFF twin of `GET /api/workspace/credits` — same payload, resolved
 * through the mobile workspace context (cookie → preference → personal).
 */
export async function GET(request: Request) {
  const session = await getAuthSession(request.headers);
  if (session === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const context = await resolveMobileWorkspaceContext(session.user.id);
  if (context === null) {
    return NextResponse.json({ error: "No workspace" }, { status: 403 });
  }

  const [balance, transactions] = await Promise.all([
    getWorkspaceCredits(context.workspaceId),
    listWorkspaceCreditTransactions(context.workspaceId, 50),
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
