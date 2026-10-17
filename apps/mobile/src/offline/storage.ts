/**
 * Storage backend contract for the offline cache. The production
 * implementation persists JSON files under `supastack-offline/` in the
 * document directory (`fs-storage.ts`); tests inject an in-memory fake.
 * Names are opaque sanitized file names — the cache owns their derivation.
 */
export interface OfflineStorage {
  /** All stored file names. */
  list(): Promise<string[]>;
  /** File contents, or null when the file does not exist / cannot be read. */
  read(name: string): Promise<string | null>;
  /** Delete a file; missing files are a no-op. */
  remove(name: string): Promise<void>;
  /** Create or overwrite a file. */
  write(name: string, text: string): Promise<void>;
}
