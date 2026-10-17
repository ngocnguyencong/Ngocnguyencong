export type FeatureRequestStatus =
  "open" | "under_review" | "planned" | "in_progress" | "shipped" | "closed";

export const FEATURE_REQUEST_STATUSES: readonly FeatureRequestStatus[] = [
  "open",
  "under_review",
  "planned",
  "in_progress",
  "shipped",
  "closed",
];

export const FEATURE_STATUS_LABELS: Record<FeatureRequestStatus, string> = {
  closed: "Closed",
  in_progress: "In progress",
  open: "Open",
  planned: "Planned",
  shipped: "Shipped",
  under_review: "Under review",
};

export interface FeatureBoardRequestItem {
  createdAt: string;
  details: string;
  id: string;
  mine: boolean;
  status: FeatureRequestStatus;
  title: string;
  voteCount: number;
}

export interface FeatureBoardPayload {
  canWrite: boolean;
  requests: FeatureBoardRequestItem[];
  votedRequestIds: string[];
  workspaceId: string;
}

export interface FeatureBoardRequestView extends FeatureBoardRequestItem {
  statusLabel: string;
  voted: boolean;
}

export interface FeatureBoardPresentation {
  canWrite: boolean;
  requests: FeatureBoardRequestView[];
  statusCounts: Partial<Record<FeatureRequestStatus, number>>;
  totalCount: number;
}

export function toFeatureBoardPresentation(payload: FeatureBoardPayload): FeatureBoardPresentation {
  const voted = new Set(payload.votedRequestIds);
  const requests = [...payload.requests]
    .sort((a, b) => b.voteCount - a.voteCount || b.createdAt.localeCompare(a.createdAt))
    .map((request) => ({
      ...request,
      statusLabel: FEATURE_STATUS_LABELS[request.status],
      voted: voted.has(request.id),
    }));
  const statusCounts: Partial<Record<FeatureRequestStatus, number>> = {};
  for (const request of requests) {
    statusCounts[request.status] = (statusCounts[request.status] ?? 0) + 1;
  }
  return {
    canWrite: payload.canWrite,
    requests,
    statusCounts,
    totalCount: requests.length,
  };
}
