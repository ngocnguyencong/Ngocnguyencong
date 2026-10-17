# src/web-chat-routes.test.ts

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

Static contract tests for the chat and AI-task routes: `/chat` stays wired to
`WebChatPage` + `getReferenceMode` + the durable client, and `/ai` mounts the
real reference console (`getReferenceMode`, `ReferenceApp`,
`ProductionReferenceApp`, `force-dynamic`) instead of redirecting to `/chat`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-13 | Added `/ai` console-mount contract (no `redirect("/chat")`) | Devin |
