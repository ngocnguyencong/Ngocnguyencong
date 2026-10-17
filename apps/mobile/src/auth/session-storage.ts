export interface SecureStoreCompatible {
  deleteItemAsync(key: string): Promise<void>;
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
}

export interface SessionStorage {
  clear(): Promise<void>;
  restore(): Promise<string | null>;
  save(session: string): Promise<void>;
}

export const mobileSessionStorageKey = "supastack.auth.session";

export function createSessionStorage(
  secureStore: SecureStoreCompatible,
  key = mobileSessionStorageKey,
): SessionStorage {
  return {
    async clear() {
      await secureStore.deleteItemAsync(key);
    },
    async restore() {
      return secureStore.getItemAsync(key);
    },
    async save(session) {
      await secureStore.setItemAsync(key, session);
    },
  };
}
