import { describe, expect, it, vi } from "vitest";

import { createRevenueCatIdentityQueue } from "./revenuecat-identity";

describe("createRevenueCatIdentityQueue", () => {
  it("serializes an identity switch behind the active workspace operation", async () => {
    const events: string[] = [];
    let finishFirst!: () => void;
    const firstOperation = new Promise<void>((resolve) => {
      finishFirst = resolve;
    });
    const queue = createRevenueCatIdentityQueue(
      {
        configure: vi.fn(({ appUserId }: { appUserId: string }) =>
          events.push(`configure:${appUserId}`),
        ),
        logIn: vi.fn(async (appUserId: string) => {
          events.push(`login:${appUserId}`);
        }),
      },
      "public-key",
    );

    const first = queue.run("workspace-a", async () => {
      events.push("operation:workspace-a:start");
      await firstOperation;
      events.push("operation:workspace-a:end");
    });
    await vi.waitFor(() => expect(events).toContain("operation:workspace-a:start"));
    const second = queue.run("workspace-b", async () => events.push("operation:workspace-b"));
    await Promise.resolve();

    expect(events).not.toContain("login:workspace-b");
    expect(events).not.toContain("operation:workspace-b");
    finishFirst();
    await Promise.all([first, second]);

    expect(events).toEqual([
      "configure:workspace-a",
      "operation:workspace-a:start",
      "operation:workspace-a:end",
      "login:workspace-b",
      "operation:workspace-b",
    ]);
  });

  it("does not run an operation when identity setup fails", async () => {
    const operation = vi.fn();
    const queue = createRevenueCatIdentityQueue(
      {
        configure: vi.fn(() => {
          throw new Error("native SDK unavailable");
        }),
        logIn: vi.fn(),
      },
      "public-key",
    );

    await expect(queue.run("workspace-a", operation)).rejects.toThrow("native SDK unavailable");
    expect(operation).not.toHaveBeenCalled();
  });
});
