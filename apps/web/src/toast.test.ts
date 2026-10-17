import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getToastSnapshot, subscribeToasts, toast } from "./toast";

describe("toast store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Drain anything a previous test left queued.
    for (const item of getToastSnapshot()) {
      toast.dismiss(item.id);
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("queues info/success/error items and notifies subscribers", () => {
    const seen: number[] = [];
    const unsubscribe = subscribeToasts(() => seen.push(getToastSnapshot().length));

    toast.info("saved");
    toast.success("done");
    toast.error("boom");

    expect(getToastSnapshot().map((item) => item.kind)).toEqual(["info", "success", "error"]);
    expect(getToastSnapshot().map((item) => item.message)).toEqual(["saved", "done", "boom"]);
    expect(seen.length).toBe(3);
    unsubscribe();
  });

  it("auto-dismisses info toasts after the default duration", () => {
    toast.info("transient");
    expect(getToastSnapshot()).toHaveLength(1);

    vi.advanceTimersByTime(4999);
    expect(getToastSnapshot()).toHaveLength(1);
    vi.advanceTimersByTime(2);
    expect(getToastSnapshot()).toHaveLength(0);
  });

  it("keeps error toasts until explicitly dismissed", () => {
    toast.error("still here");
    vi.advanceTimersByTime(60000);
    expect(getToastSnapshot()).toHaveLength(1);
  });

  it("supports a custom duration and persistent success feedback", () => {
    toast.info("brief", { durationMs: 1000 });
    toast.success("keep", { persistent: true });
    vi.advanceTimersByTime(1001);
    expect(getToastSnapshot().map((item) => item.message)).toEqual(["keep"]);
  });

  it("never evicts a persistent error to make room for routine feedback", () => {
    toast.error("Recover before continuing");
    for (let i = 0; i < 6; i++) toast.info(`Saved ${i}`);
    expect(getToastSnapshot().some((item) => item.kind === "error")).toBe(true);
  });

  it("caps the stack at four items, dropping the oldest", () => {
    for (let i = 0; i < 6; i += 1) {
      toast.info(`toast ${i}`);
    }
    const snapshot = getToastSnapshot();
    expect(snapshot).toHaveLength(4);
    expect(snapshot[0]?.message).toBe("toast 2");
    expect(snapshot[3]?.message).toBe("toast 5");
  });

  it("manual dismiss removes the item and cancels its timer", () => {
    const id = toast.info("bye");
    toast.dismiss(id);
    expect(getToastSnapshot()).toHaveLength(0);

    // Timer must not resurrect or throw after manual dismissal.
    vi.advanceTimersByTime(10000);
    expect(getToastSnapshot()).toHaveLength(0);
  });
});
