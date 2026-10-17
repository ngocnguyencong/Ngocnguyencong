export interface FeatureFlagResolutionInput {
  defaultEnabled: boolean;
  userOverride: boolean | null;
  workspaceOverride: boolean | null;
}

/** User override wins, then workspace override, then the flag default. */
export function resolveFeatureFlag(input: FeatureFlagResolutionInput): boolean {
  if (input.userOverride !== null) {
    return input.userOverride;
  }
  if (input.workspaceOverride !== null) {
    return input.workspaceOverride;
  }
  return input.defaultEnabled;
}

export function isValidFlagKey(key: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{0,99}$/.test(key);
}

export function isAnnouncementActive(
  announcement: { endsAt: Date | null; startsAt: Date },
  now: Date,
): boolean {
  if (announcement.startsAt.getTime() > now.getTime()) {
    return false;
  }
  if (announcement.endsAt !== null && announcement.endsAt.getTime() <= now.getTime()) {
    return false;
  }
  return true;
}

export type AnnouncementSeverity = "critical" | "info" | "warning";

export function normalizeAnnouncementSeverity(value: string): AnnouncementSeverity {
  return value === "critical" || value === "warning" ? value : "info";
}
