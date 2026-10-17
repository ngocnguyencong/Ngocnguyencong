import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAuthSession: vi.fn(), updateRole: vi.fn() }));
vi.mock("./auth-runtime", () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock("./mobile-organization", () => ({
  mobileOrganizationBff: { updateRole: mocks.updateRole },
}));

import { PATCH } from "../app/api/mobile/members/[userId]/route";

const context = { params: Promise.resolve({ userId: "user.with.dots" }) };
const url = "http://localhost:3000/api/mobile/members/user.with.dots";

describe("bounded member PATCH route", () => {
  beforeEach(() => {
    mocks.getAuthSession.mockReset().mockResolvedValue({ user: { id: "owner" } });
    mocks.updateRole
      .mockReset()
      .mockResolvedValue({ status: 200, body: { data: { updated: true } } });
  });

  it("authenticates before consuming an unauthenticated request body", async () => {
    mocks.getAuthSession.mockResolvedValue(null);
    const request = new Request(url, { method: "PATCH", body: '{"role":"member"}' });
    expect((await PATCH(request, context)).status).toBe(401);
    expect(request.bodyUsed).toBe(false);
    expect(mocks.updateRole).not.toHaveBeenCalled();
  });

  it("cancels a chunked oversized body even when the target contains dots", async () => {
    const cancel = vi.fn();
    let reads = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        reads += 1;
        controller.enqueue(new Uint8Array(32_768));
        if (reads === 8) controller.close();
      },
      cancel,
    });
    const request = new Request(url, { method: "PATCH", body, duplex: "half" } as RequestInit);
    expect((await PATCH(request, context)).status).toBe(413);
    expect(reads).toBeLessThan(8);
    expect(cancel).toHaveBeenCalled();
    expect(mocks.updateRole).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON without forwarding a mutation", async () => {
    expect((await PATCH(new Request(url, { method: "PATCH", body: "{" }), context)).status).toBe(
      400,
    );
    expect(mocks.updateRole).not.toHaveBeenCalled();
  });

  it("forwards bounded valid input to the workspace-scoped authorization boundary", async () => {
    expect(
      (await PATCH(new Request(url, { method: "PATCH", body: '{"role":"member"}' }), context))
        .status,
    ).toBe(200);
    expect(mocks.updateRole).toHaveBeenCalledWith(expect.any(Headers), "user.with.dots", {
      role: "member",
    });
  });
});
