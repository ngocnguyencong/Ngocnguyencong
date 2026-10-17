# Toast store and viewport

Tiny external store plus body-level Toaster. toast.info/success/error(message,{durationMs?,persistent?}) returns an ID; toast.dismiss removes it and its timer. Info/success default to5s. Errors persist until dismissed by default; explicit options can override duration/persistence. The stack evicts routine items before persistent messages; persistent errors are never dropped to fit a transient success.

Toaster keeps stable polite/urgent announcement regions and separates announcement content from visible cards. Closing cards remain mounted/inert for120ms, and stack movement uses bounded WAAPI180ms with reduced-motion guards. Root radius/status tokens reach body overlays. SSR snapshot behavior and public subscribe/snapshot APIs are preserved. Tests verify lifetime options, persistence, capacity, and manual timer cleanup.
