import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  register: vi.fn(),
  unregister: vi.fn(),
}));
vi.mock("./mobile-push-tokens", () => ({
  mobilePushTokensBff: {
    list: mocks.list,
    register: mocks.register,
    unregister: mocks.unregister,
  },
}));

import { DELETE, GET, POST } from "../app/api/mobile/push-tokens/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue({ body: { data: { tokens: [] } }, status: 200 });
  mocks.register.mockResolvedValue({
    body: { data: { token: { id: "dpt_1" } } },
    status: 201,
  });
  mocks.unregister.mockResolvedValue({ body: { data: { removed: true } }, status: 200 });
});

describe("/api/mobile/push-tokens route", () => {
  it("GET delegates to the BFF and maps the response", async () => {
    const response = await GET(new Request("https://app.test/api/mobile/push-tokens"));
    expect(mocks.list).toHaveBeenCalledWith(expect.any(Headers));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { tokens: [] } });
  });

  it("POST forwards the parsed body and maps the response status", async () => {
    const response = await POST(
      new Request("https://app.test/api/mobile/push-tokens", {
        body: JSON.stringify({ platform: "ios", token: "ExponentPushToken[x]" }),
        method: "POST",
      }),
    );
    expect(mocks.register).toHaveBeenCalledWith(expect.any(Headers), {
      platform: "ios",
      token: "ExponentPushToken[x]",
    });
    expect(response.status).toBe(201);
  });

  it("POST treats a malformed JSON body as empty input", async () => {
    const response = await POST(
      new Request("https://app.test/api/mobile/push-tokens", {
        body: "not json",
        method: "POST",
      }),
    );
    expect(mocks.register).toHaveBeenCalledWith(expect.any(Headers), {});
    expect(response.status).toBe(201);
  });

  it("DELETE forwards the token and maps the response", async () => {
    const response = await DELETE(
      new Request("https://app.test/api/mobile/push-tokens", {
        body: JSON.stringify({ token: "ExponentPushToken[x]" }),
        method: "DELETE",
      }),
    );
    expect(mocks.unregister).toHaveBeenCalledWith(expect.any(Headers), {
      token: "ExponentPushToken[x]",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { removed: true } });
  });
});
