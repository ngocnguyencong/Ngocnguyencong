import { sql, type SQL } from "drizzle-orm";

export interface WorkspaceSeatTransactionExecutor {
  execute(query: SQL): unknown;
}

export interface WorkspaceSeatDatabase<Tx extends WorkspaceSeatTransactionExecutor> {
  transaction<Result>(operation: (transaction: Tx) => Promise<Result>): Promise<Result>;
}

export function workspaceSeatLockStatement(workspaceId: string): SQL {
  return sql`select pg_advisory_xact_lock(hashtextextended(${`workspace-seats:${workspaceId}`}, 0))`;
}

/** Run a seat-affecting operation under the workspace's transaction lock. */
export async function withWorkspaceSeatTransaction<
  Tx extends WorkspaceSeatTransactionExecutor,
  Result,
>(
  database: WorkspaceSeatDatabase<Tx>,
  workspaceId: string,
  operation: (transaction: Tx) => Promise<Result>,
): Promise<Result> {
  return database.transaction(async (transaction) => {
    await transaction.execute(workspaceSeatLockStatement(workspaceId));
    return operation(transaction);
  });
}
