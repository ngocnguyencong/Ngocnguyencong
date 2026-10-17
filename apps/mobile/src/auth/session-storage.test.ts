import { expect, test } from "vitest";

const loadSessionStorage = () => import("./session-storage");

test("restores, persists, and clears a session through SecureStore-compatible storage", async () => {
  const memory = new Map<string, string>();
  const secureStore = {
    deleteItemAsync: async (key: string) => {
      memory.delete(key);
    },
    getItemAsync: async (key: string) => memory.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
      memory.set(key, value);
    },
  };
  const { createSessionStorage } = await loadSessionStorage();
  const sessions = createSessionStorage(secureStore);

  expect(await sessions.restore()).toBeNull();

  await sessions.save("encrypted-session-value");
  expect(await sessions.restore()).toBe("encrypted-session-value");

  await sessions.clear();
  expect(await sessions.restore()).toBeNull();
});
