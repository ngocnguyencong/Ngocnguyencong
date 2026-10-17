import { describe, expect, it } from "vitest";

import {
  FEATURE_STATUS_LABELS,
  toFeatureBoardPresentation,
  type FeatureBoardPayload,
} from "./presentation";

const payload: FeatureBoardPayload = {
  canWrite: true,
  requests: [
    {
      createdAt: "2026-09-22T00:00:00.000Z",
      details: "",
      id: "fr_low",
      mine: false,
      status: "open",
      title: "Low votes",
      voteCount: 1,
    },
    {
      createdAt: "2026-09-21T00:00:00.000Z",
      details: "d",
      id: "fr_high",
      mine: true,
      status: "planned",
      title: "High votes",
      voteCount: 9,
    },
  ],
  votedRequestIds: ["fr_high"],
  workspaceId: "ws-1",
};

describe("toFeatureBoardPresentation", () => {
  it("sorts by vote count then recency and flags the viewer's votes", () => {
    const view = toFeatureBoardPresentation(payload);
    expect(view.requests.map((r) => r.id)).toEqual(["fr_high", "fr_low"]);
    expect(view.requests[0]).toMatchObject({
      mine: true,
      statusLabel: "Planned",
      voted: true,
    });
    expect(view.requests[1]).toMatchObject({ mine: false, voted: false });
  });

  it("counts requests per status for filter chips", () => {
    const view = toFeatureBoardPresentation(payload);
    expect(view.statusCounts).toEqual({ open: 1, planned: 1 });
    expect(view.canWrite).toBe(true);
    expect(view.totalCount).toBe(2);
  });

  it("labels every lifecycle status", () => {
    for (const status of [
      "open",
      "under_review",
      "planned",
      "in_progress",
      "shipped",
      "closed",
    ] as const) {
      expect(FEATURE_STATUS_LABELS[status]).toBeTruthy();
    }
  });
});
