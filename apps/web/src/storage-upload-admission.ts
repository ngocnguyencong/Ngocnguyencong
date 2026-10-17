import "server-only";

import { createNamedRateLimiter } from "./rate-limit-runtime";

const perUserLimiter = createNamedRateLimiter("storage-image-user", 10, 60_000, {
  failClosed: true,
});
const perWorkspaceLimiter = createNamedRateLimiter("storage-image-workspace", 30, 60_000, {
  failClosed: true,
});
const globalLimiter = createNamedRateLimiter("storage-image-global", 120, 60_000, {
  failClosed: true,
});

export type StorageImageUploadAdmission = Readonly<{
  allowed: boolean;
  retryAfterSeconds: number;
}>;

/** Authenticated owners/managers pass trusted identifiers; form fields are never used as keys. */
export async function checkStorageImageUploadAdmission(input: {
  workspaceId: string;
  userId: string;
}): Promise<StorageImageUploadAdmission> {
  const results = await Promise.all([
    perUserLimiter.check(`workspace:${input.workspaceId}:user:${input.userId}`),
    perWorkspaceLimiter.check(`workspace:${input.workspaceId}`),
    globalLimiter.check("all"),
  ]);
  const denied = results.filter((result) => !result.allowed);
  return {
    allowed: denied.length === 0,
    retryAfterSeconds: denied.reduce(
      (retryAfter, result) => Math.max(retryAfter, result.retryAfterSeconds),
      0,
    ),
  };
}

export function storageImageUploadRateLimitResponse(retryAfterSeconds: number): Response {
  return Response.json(
    { error: "Too many uploads. Try again shortly." },
    {
      headers: { "retry-after": String(Math.max(1, retryAfterSeconds)) },
      status: 429,
    },
  );
}
