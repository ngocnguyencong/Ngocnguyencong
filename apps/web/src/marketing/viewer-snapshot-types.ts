/**
 * Server-resolved viewer identity handed to the marketing header so the first
 * render already shows the right account action.
 */
export type ViewerSnapshot = {
  signedIn: boolean;
};
