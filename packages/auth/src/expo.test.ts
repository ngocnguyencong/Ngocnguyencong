import { expect, test } from "vitest";

import { createExpoSessionStorage, expoSessionStorageKey } from "./expo.js";

test("persists a session only through the injected SecureStore-compatible API", async () => {
  const sessions = new Map<string, string>();
  const secureStore = {
    deleteItemAsync: async (key: string) => {
      sessions.delete(key);
    },
    getItemAsync: async (key: string) => sessions.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
      sessions.set(key, value);
    },
  };
  const storage = createExpoSessionStorage(secureStore);

  expect(await storage.restore()).toBeNull();

  await storage.save("session-cookie");
  expect(sessions.get(expoSessionStorageKey)).toBe("session-cookie");
  expect(await storage.restore()).toBe("session-cookie");

  await storage.clear();
  expect(await storage.restore()).toBeNull();
});
