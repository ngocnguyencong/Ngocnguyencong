/**
 * Shared task-recovery forwarding for the AI task console.
 *
 * Historically shared `?taskId`/`?submissionKey` links pointed at routes that
 * no longer host the console (`/`, `/dashboard`, `/{locale}/dashboard`,
 * `/{locale}/ai` for `en`). Each of those entry points builds the same
 * redirect target here so the param handling stays identical everywhere.
 */

/** Resolved `searchParams` record as App Router pages receive it. */
export type TaskRecoveryQuery = Record<string, string | string[] | undefined>;

/**
 * First value of a `searchParams` entry — multi-value params read as
 * `undefined` (dropped, not `arr[0]`-truncated; preserve this contract).
 */
export function firstSearchParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Returns `"{consolePath}?taskId=…&submissionKey=…"` when at least one
 * recovery param is present, otherwise `null`. Multi-value params are dropped
 * (recovery links only ever carry a single value), and values are
 * URL-encoded. Pass a localized `consolePath` (e.g. `localePath(locale,
 * "/ai")`) to target `/{locale}/ai`.
 */
export function taskRecoveryHref(query: TaskRecoveryQuery, consolePath = "/ai"): string | null {
  const recovery = new URLSearchParams();
  const taskId = firstSearchParam(query.taskId);
  const submissionKey = firstSearchParam(query.submissionKey);
  if (taskId !== undefined) recovery.set("taskId", taskId);
  if (submissionKey !== undefined) recovery.set("submissionKey", submissionKey);
  return recovery.size > 0 ? `${consolePath}?${recovery.toString()}` : null;
}
