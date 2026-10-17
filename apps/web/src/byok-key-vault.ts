import "server-only";

import {
  KeyVaultError,
  WorkspaceProviderKeyVault,
  type KeyVaultRepository,
  type PlatformKeyResolver,
  type ProviderKeyResolver,
} from "@supastack/ai";
import { createDrizzleProviderCredentialRepository } from "@supastack/db";
import type * as schema from "@supastack/db/schema";
import type { ServerConfig } from "@supastack/config";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export interface ServerProviderKeyResolverInput {
  readonly repository: KeyVaultRepository;
  readonly serverConfig: ServerConfig;
}

export interface ServerDrizzleProviderKeyResolverInput {
  readonly database: PostgresJsDatabase<typeof schema>;
  readonly serverConfig: ServerConfig;
}

/**
 * Creates the in-process resolver used by provider SDK adapters. The only
 * plaintext return value crosses directly to that server SDK call; storage is
 * always the encrypted envelope repository accepted by WorkspaceProviderKeyVault.
 */
export function createServerProviderKeyResolver(
  input: ServerProviderKeyResolverInput,
): ProviderKeyResolver {
  const platformKeys = createConfiguredPlatformKeyResolver(input.serverConfig);
  let vault: WorkspaceProviderKeyVault | undefined;

  return Object.freeze({
    async resolve(scope: Parameters<ProviderKeyResolver["resolve"]>[0]) {
      if (scope.keyMode === "platform") {
        try {
          return await platformKeys.resolve(scope);
        } catch {
          throw new KeyVaultError("Key resolution failed.");
        }
      }

      vault ??= new WorkspaceProviderKeyVault({
        masterKey: input.serverConfig.auth.credentialEncryptionKey,
        platformKeys,
        repository: input.repository,
      });
      return vault.resolve(scope);
    },
  });
}

/**
 * Convenience composition for a real server database. It intentionally keeps
 * Drizzle and the encryption master key outside client and route surfaces.
 */
export function createServerDrizzleProviderKeyResolver(
  input: ServerDrizzleProviderKeyResolverInput,
): ProviderKeyResolver {
  return createServerProviderKeyResolver({
    repository: createDrizzleProviderCredentialRepository(input.database),
    serverConfig: input.serverConfig,
  });
}

function createConfiguredPlatformKeyResolver(serverConfig: ServerConfig): PlatformKeyResolver {
  const configuredAi = serverConfig.providers.ai;

  return Object.freeze({
    async resolve(scope: Parameters<PlatformKeyResolver["resolve"]>[0]) {
      if (configuredAi.kind === "fake" || scope.provider !== configuredAi.kind) {
        throw new Error("No matching platform provider key is configured.");
      }

      return configuredAi.apiKey;
    },
  });
}
