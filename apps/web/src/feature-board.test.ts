import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  evaluateFeatureStatusChange,
  FEATURE_REQUEST_STATUSES,
  isFeatureRequestStatus,
  nextVoteCount,
  normalizeFeatureRequestInput,
} from "./feature-board";

describe("isFeatureRequestStatus", () => {
  it("accepts the six lifecycle states", () => {
    for (const status of ["open", "under_review", "planned", "in_progress", "shipped", "closed"]) {
      expect(isFeatureRequestStatus(status)).toBe(true);
    }
    expect(isFeatureRequestStatus("draft")).toBe(false);
    expect(isFeatureRequestStatus("")).toBe(false);
  });

  it("orders open states ahead of resolved ones", () => {
    expect(FEATURE_REQUEST_STATUSES.indexOf("open")).toBeLessThan(
      FEATURE_REQUEST_STATUSES.indexOf("shipped"),
    );
  });
});

describe("normalizeFeatureRequestInput", () => {
  it("trims title and details", () => {
    const result = normalizeFeatureRequestInput({
      details: "  More context here  ",
      title: "  Add dark mode  ",
    });
    expect(result).toEqual({ details: "More context here", title: "Add dark mode" });
  });

  it("defaults missing details to an empty string", () => {
    const result = normalizeFeatureRequestInput({ title: "Export to CSV" });
    expect(result).toEqual({ details: "", title: "Export to CSV" });
  });

  it("rejects missing or overlong titles and overlong details", () => {
    expect(normalizeFeatureRequestInput({ title: "" })).toEqual({ error: expect.any(String) });
    expect(normalizeFeatureRequestInput({ title: "   " })).toEqual({
      error: expect.any(String),
    });
    expect(normalizeFeatureRequestInput({ title: "x".repeat(201) })).toEqual({
      error: expect.any(String),
    });
    expect(normalizeFeatureRequestInput({ details: "x".repeat(5001), title: "ok" })).toEqual({
      error: expect.any(String),
    });
  });
});

describe("evaluateFeatureStatusChange", () => {
  it("allows free transitions between any two statuses", () => {
    expect(evaluateFeatureStatusChange({ status: "open" }, "planned")).toEqual({
      ok: true,
      status: "planned",
    });
    expect(evaluateFeatureStatusChange({ status: "shipped" }, "open")).toEqual({
      ok: true,
      status: "open",
    });
  });

  it("rejects unknown statuses and no-op transitions", () => {
    expect(evaluateFeatureStatusChange({ status: "open" }, "live")).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(evaluateFeatureStatusChange({ status: "open" }, "open")).toEqual({
      ok: false,
      reason: "unchanged",
    });
  });
});

describe("nextVoteCount", () => {
  it("increments on add and decrements on remove", () => {
    expect(nextVoteCount(3, false)).toBe(4);
    expect(nextVoteCount(3, true)).toBe(2);
  });

  it("never drops below zero", () => {
    expect(nextVoteCount(0, true)).toBe(0);
  });
});

describe("feature board server actions contract", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const actions = readFileSync(join(here, "feature-board-actions.ts"), "utf8");

  it("scopes every query and mutation by workspaceId", () => {
    expect(actions).toContain("eq(featureRequest.workspaceId, context.workspaceId)");
    expect(actions.match(/eq\(featureRequest\.workspaceId/g)?.length).toBeGreaterThanOrEqual(3);
    expect(actions).toContain("eq(featureRequestVote.workspaceId, context.workspaceId)");
  });

  it("gates submit/vote behind the writer role and triage behind the manager role", () => {
    expect(actions).toContain("requireWorkspaceViewer()");
    expect(actions.match(/requireWorkspaceWriter\(\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(actions.match(/requireWorkspaceManager\(\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("records audit events and emits board webhooks", () => {
    expect(actions).toContain("AUDIT_ACTIONS.featureRequestCreated");
    expect(actions).toContain("AUDIT_ACTIONS.featureRequestStatusChanged");
    expect(actions).toContain("AUDIT_ACTIONS.featureRequestDeleted");
    expect(actions).toContain('"feature_request.created"');
    expect(actions).toContain('"feature_request.status_changed"');
  });

  it("keeps request+vote writes in one shared store transaction", () => {
    const store = readFileSync(join(here, "feature-board-store.ts"), "utf8");
    expect(store.match(/database\.transaction/g)?.length).toBeGreaterThanOrEqual(2);
    expect(store).toContain("featureRequestVote");
    expect(actions).toContain("insertFeatureRequestWithAuthorVote");
    expect(actions).toContain("toggleFeatureRequestVote");
  });
});
