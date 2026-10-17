/** True while a request callback still belongs to the active conversation. */
export function isCurrentChatRequest(
  current: AbortController | null,
  request: AbortController,
): boolean {
  return current === request;
}
