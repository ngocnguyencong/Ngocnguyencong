import { describe, expect, it } from "vitest";

import { firstSearchParam, taskRecoveryHref } from "./ai-task-recovery";

describe("taskRecoveryHref", () => {
  it("builds the console href with both recovery params", () => {
    expect(taskRecoveryHref({ taskId: "task_shared_1", submissionKey: "sub_key_9" })).toBe(
      "/ai?taskId=task_shared_1&submissionKey=sub_key_9",
    );
  });

  it("forwards taskId alone", () => {
    expect(taskRecoveryHref({ taskId: "task_shared_1" })).toBe("/ai?taskId=task_shared_1");
  });

  it("forwards submissionKey alone", () => {
    expect(taskRecoveryHref({ submissionKey: "sub_key_9" })).toBe("/ai?submissionKey=sub_key_9");
  });

  it("returns null when neither param is present", () => {
    expect(taskRecoveryHref({})).toBeNull();
    expect(taskRecoveryHref({ waitlist: "joined" })).toBeNull();
  });

  it("drops array values instead of picking one", () => {
    expect(taskRecoveryHref({ taskId: ["task_a", "task_b"], submissionKey: "sub_key_9" })).toBe(
      "/ai?submissionKey=sub_key_9",
    );
    expect(taskRecoveryHref({ taskId: ["task_a", "task_b"] })).toBeNull();
  });

  it("targets a caller-supplied console path for localized routes", () => {
    expect(taskRecoveryHref({ taskId: "task_1" }, "/de/ai")).toBe("/de/ai?taskId=task_1");
    expect(taskRecoveryHref({}, "/de/ai")).toBeNull();
  });

  it("preserves empty-string params (same as the pre-extraction inline code)", () => {
    expect(taskRecoveryHref({ taskId: "" })).toBe("/ai?taskId=");
  });

  it("exposes firstSearchParam for sibling param narrowing", () => {
    expect(firstSearchParam("a")).toBe("a");
    expect(firstSearchParam(["a", "b"])).toBeUndefined();
    expect(firstSearchParam(undefined)).toBeUndefined();
  });

  it("encodes param values for the query string", () => {
    expect(taskRecoveryHref({ taskId: "task with spaces&=" })).toBe(
      "/ai?taskId=task+with+spaces%26%3D",
    );
  });
});
