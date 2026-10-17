# Documentation client tools

DocsSearchPalette retains localized shortcut/search/result behavior and the server ?q= no-JavaScript path. Its shared native Dialog contains focus, closes by Escape/backdrop, locks scrolling, and restores the trigger; close labels are localized separately from Search.

DocsMotion enhances navGroup/mobileSidebar details with shared220ms opening/160ms closing. Repeated clicks reverse from the current height; animation identity guards queued cancel cleanup so replaced animations keep their tracking. Reduced motion/missingWAAPI fall back to native toggles. An asynchronous cancel regression verifies rapid close/open/close.

DocsSideScroll preserves sidebar scroll positions; CopyMarkdownButton retains clipboard behavior. Preserve content, guide routing, and reading layouts outside the approved foundation scope.
