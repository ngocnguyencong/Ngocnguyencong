import type { parseServerConfig } from "@supastack/config";

export function getReferenceMode(config: ReturnType<typeof parseServerConfig>) {
  const { app, providers } = config;
  if (
    process.env.NODE_ENV !== "production" &&
    (app.environment === "local" || app.environment === "test") &&
    providers.ai.kind === "fake" &&
    providers.billing.kind === "local" &&
    providers.email.kind === "local" &&
    providers.jobs.kind === "local"
  ) {
    return { mode: "local" as const };
  }
  const aliases = (["fast", "smart", "cheap"] as const).filter(
    (alias) => config.aiRouting === undefined || config.aiRouting[alias].length > 0,
  );
  return {
    mode: "production" as const,
    aiEnabled: providers.jobs.kind === "trigger" && aliases.length > 0,
    aliases,
  };
}
