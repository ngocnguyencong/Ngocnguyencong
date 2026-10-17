/** The single default key used by the injected SecureStore session adapter. */
export const expoSessionStorageKey = "supastack.auth.session";

/** The encrypted subset of Expo SecureStore required for session persistence. */
export interface ExpoSecureStoreCompatible {
  deleteItemAsync(key: string): Promise<void>;
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
}

export interface ExpoSessionStorage {
  clear(): Promise<void>;
  restore(): Promise<string | null>;
  save(session: string): Promise<void>;
}

/**
 * Binds sessions to an injected Expo SecureStore-compatible encrypted store.
 * No general-purpose or unencrypted storage implementation is accepted here.
 */
export function createExpoSessionStorage(
  secureStore: ExpoSecureStoreCompatible,
  key = expoSessionStorageKey,
): ExpoSessionStorage {
  return {
    clear: () => secureStore.deleteItemAsync(key),
    restore: () => secureStore.getItemAsync(key),
    save: (session) => secureStore.setItemAsync(key, session),
  };
}
