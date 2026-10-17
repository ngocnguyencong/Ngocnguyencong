import { describe, expect, it, vi } from "vitest";

import {
  registerForPushNotifications,
  unregisterPushNotifications,
  type PushNotificationAdapter,
  type PushTokenApi,
  type PushTokenStore,
} from "./register";

function makeAdapter(overrides: Partial<PushNotificationAdapter> = {}): PushNotificationAdapter {
  return {
    getPermission: async () => "granted",
    getProjectId: () => "project-1",
    getPushToken: async () => "ExponentPushToken[device-1]",
    platform: "ios",
    requestPermission: async () => "granted",
    ...overrides,
  };
}

function makeApi(overrides: Partial<PushTokenApi> = {}) {
  return {
    api: {
      register: vi.fn(async () => ({})),
      unregister: vi.fn(async () => ({})),
      ...overrides,
    } as PushTokenApi & {
      register: ReturnType<typeof vi.fn>;
      unregister: ReturnType<typeof vi.fn>;
    },
  };
}

function makeStore(): PushTokenStore & {
  clear: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
} {
  return {
    clear: vi.fn(async () => undefined),
    load: vi.fn(async () => "ExponentPushToken[stored]"),
    save: vi.fn(async () => undefined),
  };
}

describe("registerForPushNotifications", () => {
  it("registers the Expo token with the BFF and persists it locally", async () => {
    const store = makeStore();
    const { api } = makeApi();
    const result = await registerForPushNotifications({
      adapter: makeAdapter(),
      api,
      store,
    });

    expect(result).toEqual({ kind: "registered", token: "ExponentPushToken[device-1]" });
    expect(api.register).toHaveBeenCalledWith({
      platform: "ios",
      token: "ExponentPushToken[device-1]",
    });
    expect(store.save).toHaveBeenCalledWith("ExponentPushToken[device-1]");
  });

  it("requests permission when undetermined and stops when denied", async () => {
    const requestPermission = vi.fn(async () => "denied" as const);
    const { api } = makeApi();
    const result = await registerForPushNotifications({
      adapter: makeAdapter({
        getPermission: async () => "undetermined",
        requestPermission,
      }),
      api,
    });

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ kind: "permission_denied" });
    expect(api.register).not.toHaveBeenCalled();
  });

  it("returns unavailable without a project id — config-less dev builds", async () => {
    const result = await registerForPushNotifications({
      adapter: makeAdapter({ getProjectId: () => null }),
      api: makeApi().api,
    });
    expect(result).toEqual({ kind: "unavailable" });
  });

  it("returns unavailable when the token fetch rejects (simulator, Expo Go, offline)", async () => {
    const { api } = makeApi();
    const result = await registerForPushNotifications({
      adapter: makeAdapter({
        getPushToken: async () => {
          throw new Error("no device token");
        },
      }),
      api,
    });
    expect(result).toEqual({ kind: "unavailable" });
    expect(api.register).not.toHaveBeenCalled();
  });

  it("returns unavailable when the BFF registration rejects", async () => {
    const { api } = makeApi({
      register: vi.fn(async () => {
        throw new Error("offline");
      }),
    });
    const result = await registerForPushNotifications({ adapter: makeAdapter(), api });
    expect(result).toEqual({ kind: "unavailable" });
  });

  it("still registers when optional channel setup fails", async () => {
    const result = await registerForPushNotifications({
      adapter: makeAdapter({
        configureAndroidChannel: async () => {
          throw new Error("channel failure");
        },
        platform: "android",
      }),
      api: makeApi().api,
    });
    expect(result).toEqual({ kind: "registered", token: "ExponentPushToken[device-1]" });
  });
});

describe("unregisterPushNotifications", () => {
  it("deletes the stored token server-side and clears the store", async () => {
    const store = makeStore();
    const { api } = makeApi();
    await expect(unregisterPushNotifications({ api, store })).resolves.toBe(true);

    expect(api.unregister).toHaveBeenCalledWith("ExponentPushToken[stored]");
    expect(store.clear).toHaveBeenCalledTimes(1);
  });

  it("deletes an explicit token without touching the store load", async () => {
    const store = makeStore();
    const { api } = makeApi();
    await expect(
      unregisterPushNotifications({ api, store, token: "ExponentPushToken[explicit]" }),
    ).resolves.toBe(true);

    expect(api.unregister).toHaveBeenCalledWith("ExponentPushToken[explicit]");
    expect(store.load).not.toHaveBeenCalled();
  });

  it("resolves true when no token is stored — nothing to delete", async () => {
    const store = makeStore();
    store.load.mockResolvedValue(null);
    const { api } = makeApi();
    await expect(unregisterPushNotifications({ api, store })).resolves.toBe(true);
    expect(api.unregister).not.toHaveBeenCalled();
    expect(store.clear).toHaveBeenCalledTimes(1);
  });

  it("resolves false when the server delete fails but still clears local state", async () => {
    const store = makeStore();
    const { api } = makeApi({
      unregister: vi.fn(async () => {
        throw new Error("offline");
      }),
    });
    await expect(
      unregisterPushNotifications({ api, store, token: "ExponentPushToken[x]" }),
    ).resolves.toBe(false);
    expect(store.clear).toHaveBeenCalledTimes(1);
  });
});
