export const FEATURE_REQUEST_STATUSES = [
  "open",
  "under_review",
  "planned",
  "in_progress",
  "shipped",
  "closed",
] as const;
export type FeatureRequestStatus = (typeof FEATURE_REQUEST_STATUSES)[number];

export function isFeatureRequestStatus(value: unknown): value is FeatureRequestStatus {
  return (
    typeof value === "string" && (FEATURE_REQUEST_STATUSES as readonly string[]).includes(value)
  );
}

export type FeatureRequestDraft = Readonly<{
  details: string;
  title: string;
}>;

export function normalizeFeatureRequestInput(
  raw: Readonly<{ details?: string | undefined; title?: string | undefined }>,
): FeatureRequestDraft | { error: string } {
  const title = (raw.title ?? "").trim();
  if (title.length === 0 || title.length > 200) {
    return { error: "A title of 1-200 characters is required." };
  }
  const details = (raw.details ?? "").trim();
  if (details.length > 5000) {
    return { error: "Details must be 5000 characters or fewer." };
  }
  return { details, title };
}

export type FeatureStatusDecision =
  | Readonly<{ ok: true; status: FeatureRequestStatus }>
  | Readonly<{ ok: false; reason: "invalid" | "unchanged" }>;

/** Status triage is free-form — managers move requests between any two states. */
export function evaluateFeatureStatusChange(
  current: Readonly<{ status: string }>,
  next: string,
): FeatureStatusDecision {
  if (!isFeatureRequestStatus(next)) {
    return { ok: false, reason: "invalid" };
  }
  if (next === current.status) {
    return { ok: false, reason: "unchanged" };
  }
  return { ok: true, status: next };
}

/** Counter-cache update for a vote toggle; the floor keeps drift harmless. */
export function nextVoteCount(current: number, hasVoted: boolean): number {
  return Math.max(0, current + (hasVoted ? -1 : 1));
}
