/**
 * Shared Postgres error detectors for server actions. Postgres surfaces
 * SQLSTATE on the driver's `code` property — 23505 is unique_violation.
 */

/** True when the driver error is a unique-constraint violation (23505). */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}
