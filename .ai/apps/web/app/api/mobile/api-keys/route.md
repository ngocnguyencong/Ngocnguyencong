# app/api/mobile/api-keys/route.ts

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

开发者 API key 管理 —— 直接复用 `listWorkspaceApiKeys` /
`createApiKeyAction`（内部 `requireWorkspaceManager`，owner/admin）。

## What It Does

- `GET` → `{keys, manageable}`（prefix/scopes/status，不含明文）
- `POST {name, scopes[], expiresInDays?}` → 201 `{keyId, plaintext}` —
  明文仅此一次返回，库里只存 sha256。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Created | Devin |
