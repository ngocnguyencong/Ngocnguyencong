# Theme startup

Server-only composition of the style catalog and pre-paint boot script.
Resolve `DEFAULT_STYLE_ID` once and export its HTML attributes plus the boot
script with matching fallback values. Render defaults without JavaScript;
valid saved visitor preferences remain authoritative after script execution.
Keep the style import here rather than inside the color catalog.
