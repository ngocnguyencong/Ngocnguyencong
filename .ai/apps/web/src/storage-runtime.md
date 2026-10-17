# apps/web/src/storage-runtime.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Server-only object-storage composition: `createServerObjectStorage`
returns `MemoryObjectStorage` or `S3CompatibleObjectStorage` over an AWS
SDK v3 `S3Client` built here (secrets stay at this edge;
`@supastack/storage` sees only the narrow `S3CompatibleClient` surface).
Region and `forcePathStyle` come from `STORAGE_REGION` /
`STORAGE_FORCE_PATH_STYLE` config — path style defaults on for custom
endpoints (Supabase Storage, MinIO).

Image uploads use `storage-image-lifecycle.ts` for stable per-owner avatar
and per-workspace logo object keys, advisory-lock serialization, metadata
upsert, and bounded cleanup of legacy image rows. `storage-upload-admission.ts`
gates authenticated uploads with fail-closed user, workspace, and global
quotas before route multipart parsing.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Config-driven region + forcePathStyle (phase B4) | Devin |
