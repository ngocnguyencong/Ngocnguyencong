# app/(app)/chat/[threadId].tsx

> Last updated: 2026-10-01 | Protection: STANDARD

## Purpose

Conversation screen: loads saved thread messages, renders user/assistant
bubbles, and sends chat requests with `fast`/`smart`/`cheap` alias selection
and a structured-output option. Stop aborts the Expo fetch and server model
request. New chat creates a new saved thread and preserves prior history;
thread changes and sign-out clear the current draft and rendered state. Errors
and stopped notices are shown without leaving an empty assistant bubble. Async
callbacks are ignored after the active request changes; a manually stopped
request still reports its stopped notice. Model, structured-output, send/stop,
and navigation controls expose accessible state and at least 48dp hit areas.

The backend currently calls `generateText` to completion before splitting its
reply into SSE chunks, so Stop cancels work during generation but does not
expose partial provider tokens.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Created | Devin |
| 2026-10-01 | Add model controls, stop, and new-chat flow | Codex |
| 2026-10-01 | Guard stale callbacks, remove SSE-error placeholders, and enlarge controls | Codex |
