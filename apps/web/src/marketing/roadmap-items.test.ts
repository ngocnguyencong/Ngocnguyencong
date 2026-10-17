import { describe, expect, it } from "vitest";

import {
  groupRoadmapItems,
  ROADMAP_STATUS_LABELS,
  ROADMAP_STATUS_ORDER,
  roadmapItems,
  type RoadmapStatus,
} from "./roadmap-items";

const VALID_STATUSES: readonly RoadmapStatus[] = ["planned", "in_progress", "shipped"];

describe("roadmapItems", () => {
  it("is non-empty with valid statuses and complete copy", () => {
    expect(roadmapItems.length).toBeGreaterThan(0);
    for (const item of roadmapItems) {
      expect(VALID_STATUSES, item.title).toContain(item.status);
      expect(item.title.trim().length).toBeGreaterThan(0);
      expect(item.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("never promises dates or carries workspace-private rows", () => {
    const blob = JSON.stringify(roadmapItems);
    expect(blob).not.toMatch(/\bQ[1-4]\s*\d{4}|\bETA\b|by \w+ \d{4}|coming soon/i);
  });

  it("covers each status at least once", () => {
    for (const status of VALID_STATUSES) {
      expect(
        roadmapItems.some((item) => item.status === status),
        status,
      ).toBe(true);
    }
  });
});

describe("groupRoadmapItems", () => {
  it("groups shipped first, then in progress, then planned", () => {
    const groups = groupRoadmapItems(roadmapItems);
    expect(groups.map((group) => group.status)).toEqual(
      ROADMAP_STATUS_ORDER.filter((status) => roadmapItems.some((item) => item.status === status)),
    );
    expect(groups.every((group) => group.label === ROADMAP_STATUS_LABELS[group.status])).toBe(true);
    expect(groups.flatMap((group) => group.items)).toHaveLength(roadmapItems.length);
  });

  it("drops empty status groups", () => {
    const groups = groupRoadmapItems(roadmapItems.filter((item) => item.status === "planned"));
    expect(groups.map((group) => group.status)).toEqual(["planned"]);
  });
});
