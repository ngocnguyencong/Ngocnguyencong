# Theme ownership contracts

Keep app and marketing stylesheet ownership separate. Marketing follows the
configured style by default; a locked black palette remains an explicit option.
Tests cover the optional lock selector, subtree bypass, shared preset axes,
theme tokens, and app layouts.

2026-10-06: Structural defaults are document-root foundation tokens so overlays share them; app/marketing retain their surface rules. Tests enforce this ownership split.
