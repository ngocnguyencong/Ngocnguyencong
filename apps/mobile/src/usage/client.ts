import type { MobileApiClient } from "../api/client";

/** One meter row from `GET /api/mobile/usage`. */
export interface UsageMeter {
  cap: number | null;
  description: string;
  key: string;
  label: string;
  limit: number | null;
  planLimit: number | null;
  used: number;
}

/** The workspace's current-month usage overview — mirrors the web payload. */
export interface WorkspaceUsageOverview {
  ai: {
    budgetMicrounits: string | null;
    committedMicrounits: string;
    heldMicrounits: string;
    isDefaultBudget: boolean;
    keyMode: string;
  };
  credits: { balance: number };
  meters: UsageMeter[];
  periodEnd: string;
  periodStart: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toMeter(value: unknown): UsageMeter | null {
  if (!isRecord(value)) {
    return null;
  }
  // Rows without a usable key/label are dropped rather than guessed —
  // defaults would mislabel meters and collide on React keys.
  if (
    typeof value.key !== "string" ||
    value.key.length === 0 ||
    typeof value.label !== "string" ||
    value.label.length === 0 ||
    typeof value.used !== "number"
  ) {
    return null;
  }
  return {
    cap: optionalNumber(value.cap),
    description: typeof value.description === "string" ? value.description : "",
    key: value.key,
    label: value.label,
    limit: optionalNumber(value.limit),
    planLimit: optionalNumber(value.planLimit),
    used: value.used,
  };
}

function isMicrounitString(value: unknown): value is string {
  return typeof value === "string" && /^\d+$/.test(value);
}

/** `GET /api/mobile/usage` — the workspace's usage overview (read-only). */
export function createMobileUsageActions(api: MobileApiClient) {
  return {
    async get(): Promise<WorkspaceUsageOverview> {
      const payload = await api.request<unknown>("/api/mobile/usage");
      if (
        !isRecord(payload) ||
        !isRecord(payload.ai) ||
        !isRecord(payload.credits) ||
        typeof payload.credits.balance !== "number"
      ) {
        throw new Error("The workspace usage was invalid.");
      }
      const ai = payload.ai;
      if (
        !isMicrounitString(ai.committedMicrounits) ||
        !isMicrounitString(ai.heldMicrounits) ||
        (ai.budgetMicrounits !== null && !isMicrounitString(ai.budgetMicrounits))
      ) {
        throw new Error("The workspace usage was invalid.");
      }
      const meters = Array.isArray(payload.meters)
        ? payload.meters.map(toMeter).filter((row): row is UsageMeter => row !== null)
        : [];
      return {
        ai: {
          budgetMicrounits: ai.budgetMicrounits === null ? null : ai.budgetMicrounits,
          committedMicrounits: ai.committedMicrounits,
          heldMicrounits: ai.heldMicrounits,
          isDefaultBudget: ai.isDefaultBudget === true,
          keyMode: typeof ai.keyMode === "string" ? ai.keyMode : "platform",
        },
        credits: { balance: payload.credits.balance },
        meters,
        periodEnd: typeof payload.periodEnd === "string" ? payload.periodEnd : "",
        periodStart: typeof payload.periodStart === "string" ? payload.periodStart : "",
      };
    },
  };
}
