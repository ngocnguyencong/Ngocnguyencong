import { parseServerConfig, type ServerConfig } from "@supastack/config";

export type RealProviderSmokeConfig = Readonly<{
  aiModel: string;
  aiModelVersion: string;
  emailAllowedDomain: string;
  emailTo: string;
  serverConfig: ServerConfig;
  triggerProjectRef: string | null;
  triggerTask: string | null;
  workspaceId: string;
}>;

/** Fails closed before any real-provider client can be constructed. */
export function parseRealProviderSmokeConfig(
  environment: Record<string, string | undefined> = process.env,
): RealProviderSmokeConfig {
  if (environment.RUN_REAL_PROVIDER_SMOKE !== "true") {
    throw new Error("Set RUN_REAL_PROVIDER_SMOKE=true to authorize real provider network calls.");
  }

  const serverConfig = parseServerConfig(environment);
  if (serverConfig.providers.ai.kind !== "openai") {
    throw new Error("The Core V1 real smoke requires the composed OpenAI provider.");
  }
  if (serverConfig.providers.email.kind === "local") {
    throw new Error("The real smoke requires Resend or SES transactional email.");
  }
  if (serverConfig.providers.billing.kind !== "stripe") {
    throw new Error("The real smoke requires a Stripe sandbox provider configuration.");
  }
  if (environment.REAL_SMOKE_STRIPE_MODE !== "sandbox") {
    throw new Error("REAL_SMOKE_STRIPE_MODE=sandbox is required; live billing is forbidden here.");
  }

  const appUrl = required(environment, "APP_URL");
  if (!isExactHttpsOrigin(appUrl)) {
    throw new Error("APP_URL must be an exact non-local HTTPS origin for the real provider smoke.");
  }
  const aiModel = required(environment, "REAL_SMOKE_AI_MODEL");
  const aiModelVersion = required(environment, "REAL_SMOKE_AI_MODEL_VERSION");
  const emailAllowedDomain = required(environment, "REAL_SMOKE_EMAIL_ALLOWED_DOMAIN").toLowerCase();
  const emailTo = required(environment, "REAL_SMOKE_EMAIL_TO");
  const workspaceId = required(environment, "REAL_SMOKE_WORKSPACE_ID");

  if (!isEmailAddress(emailTo)) {
    throw new Error("REAL_SMOKE_EMAIL_TO must be one valid email address.");
  }
  if (!isEmailDomain(emailAllowedDomain)) {
    throw new Error("REAL_SMOKE_EMAIL_ALLOWED_DOMAIN must be one valid domain name.");
  }
  if (emailTo.slice(emailTo.lastIndexOf("@") + 1).toLowerCase() !== emailAllowedDomain) {
    throw new Error("REAL_SMOKE_EMAIL_TO must use REAL_SMOKE_EMAIL_ALLOWED_DOMAIN.");
  }

  const trigger = triggerConfig(serverConfig, environment);

  return {
    aiModel,
    aiModelVersion,
    emailAllowedDomain,
    emailTo,
    serverConfig,
    triggerProjectRef: trigger?.projectRef ?? null,
    triggerTask: trigger?.task ?? null,
    workspaceId,
  };
}

function required(environment: Record<string, string | undefined>, name: string): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for the real provider smoke.`);
  }

  return value;
}

function isExactHttpsOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === "" &&
      url.hostname !== "localhost" &&
      url.hostname !== "127.0.0.1" &&
      url.hostname !== "[::1]" &&
      !url.hostname.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}

function isEmailDomain(value: string): boolean {
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value);
}

function isEmailAddress(value: string): boolean {
  const separator = value.lastIndexOf("@");
  if (separator <= 0 || separator === value.length - 1 || value.length > 254) {
    return false;
  }

  const localPart = value.slice(0, separator);
  const domain = value.slice(separator + 1);
  return (
    localPart.length <= 64 &&
    /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(localPart) &&
    !localPart.startsWith(".") &&
    !localPart.endsWith(".") &&
    !localPart.includes("..") &&
    isEmailDomain(domain)
  );
}

function triggerConfig(
  serverConfig: ServerConfig,
  environment: Record<string, string | undefined>,
): Readonly<{ projectRef: string; task: string }> | null {
  if (serverConfig.providers.jobs.kind !== "trigger") {
    return null;
  }

  const projectRef = required(environment, "REAL_SMOKE_TRIGGER_PROJECT_REF");
  const task = required(environment, "REAL_SMOKE_TRIGGER_TASK");
  if (projectRef !== serverConfig.providers.jobs.projectRef) {
    throw new Error("REAL_SMOKE_TRIGGER_PROJECT_REF must match TRIGGER_PROJECT_REF.");
  }
  if (!task.startsWith("smoke.")) {
    throw new Error("REAL_SMOKE_TRIGGER_TASK must name a dedicated smoke. task.");
  }

  return { projectRef, task };
}
