/**
 * Shared JSON client for the cookie-authenticated `/api/*` surface. Each
 * domain module builds a thin typed wrapper over `request` so the
 * cookie/error/parse plumbing lives in exactly one place.
 */

export interface MobileApiClientConfig {
  apiUrl: string;
  getCookie: () => Promise<string | null | undefined>;
}

export type MobileApiFetch = (
  url: string,
  init: { body?: string; headers: Record<string, string>; method: string },
) => Promise<{ json: () => Promise<unknown>; ok: boolean; status: number }>;

export class MobileApiError extends Error {
  readonly code: string | null;
  readonly status: number;

  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.code = code;
    this.name = "MobileApiError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(value: unknown, status: number): { code: string | null; message: string } {
  if (isRecord(value)) {
    if (isRecord(value.error)) {
      return {
        code: typeof value.error.code === "string" ? value.error.code : null,
        message:
          typeof value.error.message === "string" ? value.error.message : fallbackMessage(status),
      };
    }
    if (typeof value.error === "string") {
      return { code: null, message: value.error };
    }
  }
  return { code: null, message: fallbackMessage(status) };
}

function fallbackMessage(status: number): string {
  if (status === 401) return "Sign in to continue.";
  if (status === 403) return "You do not have permission for that action.";
  if (status === 404) return "That resource could not be found.";
  return "The request could not be completed.";
}

export function createMobileApiClient(
  config: MobileApiClientConfig,
  transport: MobileApiFetch = (url, init) => fetch(url, init),
) {
  async function cookie(): Promise<string> {
    const value = await config.getCookie();
    if (!value) {
      throw new MobileApiError(401, "Your authentication session is unavailable.");
    }
    return value;
  }

  async function request<T>(
    path: string,
    init: {
      body?: unknown;
      method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
      parse?: (value: unknown) => T;
    } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      Cookie: await cookie(),
    };
    let body: string | undefined;
    if (init.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(init.body);
    }
    const response = await transport(new URL(path, config.apiUrl).toString(), {
      ...(body !== undefined ? { body } : {}),
      headers,
      method: init.method ?? "GET",
    });
    const payload = await response.json();
    if (!response.ok) {
      const { code, message } = errorMessage(payload, response.status);
      throw new MobileApiError(response.status, message, code);
    }
    return init.parse === undefined ? (payload as T) : init.parse(payload);
  }

  return { request };
}

export type MobileApiClient = ReturnType<typeof createMobileApiClient>;
