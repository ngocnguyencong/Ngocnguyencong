# app/api/mobile/api-keys/[keyId]/route.ts

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

`DELETE` —— 吊销 API key。先 `requireWorkspaceManager` 鉴权，再构造
FormData 调用 `revokeApiKeyAction`（与 web 设置页同一实现：软吊销 +
审计）。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Created | Devin |
