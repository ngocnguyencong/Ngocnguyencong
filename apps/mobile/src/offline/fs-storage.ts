import { Directory, File, Paths } from "expo-file-system";

import type { OfflineStorage } from "./storage";

/**
 * File-backed OfflineStorage using the expo-file-system (SDK 57) API.
 * Entries live as JSON files in `<document>/supastack-offline/` — the
 * document directory survives app restarts and OS cache purges.
 */
export function createFileSystemOfflineStorage(
  directory: Directory = new Directory(Paths.document, "supastack-offline"),
): OfflineStorage {
  function ensureDirectory() {
    if (!directory.exists) {
      directory.create({ idempotent: true, intermediates: true });
    }
  }

  return {
    async list() {
      if (!directory.exists) return [];
      return directory
        .list()
        .filter((entry): entry is File => entry instanceof File)
        .map((entry) => entry.name);
    },

    async read(name) {
      const file = new File(directory, name);
      if (!file.exists) return null;
      try {
        return await file.text();
      } catch {
        return null;
      }
    },

    async remove(name) {
      const file = new File(directory, name);
      if (file.exists) file.delete();
    },

    async write(name, text) {
      ensureDirectory();
      const file = new File(directory, name);
      file.create({ intermediates: true, overwrite: true });
      file.write(text);
    },
  };
}
