import {
  FEATURE_REQUEST_STATUSES,
  type FeatureBoardPayload,
  type FeatureBoardRequestItem,
  type FeatureRequestStatus,
} from "./presentation";

const boardEndpoint = "/api/mobile/feature-requests";

export interface MobileFeatureBoardClient {
  apiUrl: string;
  getCookie: () => Promise<string | null | undefined>;
}

export interface MobileFeatureBoardResponse {
  json: () => Promise<unknown>;
  ok: boolean;
  status: number;
}

export type MobileFeatureBoardFetch = (
  url: string,
  init: {
    body?: string;
    headers: Record<string, string>;
    method: "GET" | "POST";
  },
) => Promise<MobileFeatureBoardResponse>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFeatureRequestStatus(value: unknown): value is FeatureRequestStatus {
  return (
    typeof value === "string" && (FEATURE_REQUEST_STATUSES as readonly string[]).includes(value)
  );
}

function isRequestItem(value: unknown): value is FeatureBoardRequestItem {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.details === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.voteCount === "number" &&
    typeof value.mine === "boolean" &&
    isFeatureRequestStatus(value.status)
  );
}

function parseBoardPayload(value: unknown): FeatureBoardPayload {
  if (!isRecord(value) || !isRecord(value.data)) {
    throw new Error("The feature board response was invalid.");
  }
  const { canWrite, requests, votedRequestIds, workspaceId } = value.data;
  if (
    typeof canWrite !== "boolean" ||
    !Array.isArray(requests) ||
    !requests.every(isRequestItem) ||
    !Array.isArray(votedRequestIds) ||
    !votedRequestIds.every((id) => typeof id === "string") ||
    typeof workspaceId !== "string"
  ) {
    throw new Error("The feature board response was invalid.");
  }
  return { canWrite, requests, votedRequestIds, workspaceId };
}

function parseRequestPayload(value: unknown): FeatureBoardRequestItem {
  if (!isRecord(value) || !isRecord(value.data) || !isRequestItem(value.data.request)) {
    throw new Error("The feature request response was invalid.");
  }
  return value.data.request;
}

function parseVotePayload(value: unknown): { voteCount: number; voted: boolean } {
  if (!isRecord(value) || !isRecord(value.data)) {
    throw new Error("The vote response was invalid.");
  }
  const { voteCount, voted } = value.data;
  if (typeof voteCount !== "number" || typeof voted !== "boolean") {
    throw new Error("The vote response was invalid.");
  }
  return { voteCount, voted };
}

function responseErrorMessage(value: unknown, status: number): string {
  if (isRecord(value) && isRecord(value.error) && typeof value.error.message === "string") {
    return value.error.message;
  }
  return status === 401
    ? "Sign in before viewing the feature board."
    : "The feature board could not be loaded.";
}

async function requestJson<T>(
  request: MobileFeatureBoardFetch,
  url: string,
  init: { body?: string; headers: Record<string, string>; method: "GET" | "POST" },
  parse: (value: unknown) => T,
): Promise<T> {
  const response = await request(url, init);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(responseErrorMessage(payload, response.status));
  }
  return parse(payload);
}

/** Cookie-backed actions for the mobile feature-board endpoints. */
export function createMobileFeatureBoardActions(
  client: MobileFeatureBoardClient,
  request: MobileFeatureBoardFetch = (url, init) => fetch(url, init),
) {
  const boardUrl = new URL(boardEndpoint, client.apiUrl).toString();

  async function cookieHeader(): Promise<Record<string, string>> {
    const cookie = await client.getCookie();
    if (!cookie) {
      throw new Error("Your authentication session is unavailable.");
    }
    return { Accept: "application/json", Cookie: cookie };
  }

  return {
    async fetchBoard(): Promise<FeatureBoardPayload> {
      const headers = await cookieHeader();
      return requestJson(request, boardUrl, { headers, method: "GET" }, parseBoardPayload);
    },

    async createRequest(input: {
      details?: string;
      title: string;
    }): Promise<FeatureBoardRequestItem> {
      const headers = await cookieHeader();
      return requestJson(
        request,
        boardUrl,
        {
          body: JSON.stringify({ details: input.details, title: input.title }),
          headers: { ...headers, "Content-Type": "application/json" },
          method: "POST",
        },
        parseRequestPayload,
      );
    },

    async toggleVote(requestId: string): Promise<{ voteCount: number; voted: boolean }> {
      const headers = await cookieHeader();
      const url = new URL(
        `${boardEndpoint}/${encodeURIComponent(requestId)}/vote`,
        client.apiUrl,
      ).toString();
      return requestJson(request, url, { headers, method: "POST" }, parseVotePayload);
    },
  };
}
