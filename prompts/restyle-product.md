# Prompt: re-theme a page

Bring `<route or component>` onto the kit's token system so it restyles with
every pack, preset, and layout. Right now it `<what's wrong: hardcoded colors /
one-off CSS / fixed layout / etc.>`.

1. Inventory the file(s): list every hardcoded color, px-sized spacing that
   duplicates a token, and any selector that fights `.app-theme` or
   `.marketing-theme`.
2. Replace hardcodes with tokens: `var(--page|--section|--raised|--text|
--muted|--border|--border-strong|--accent|--accent-ink|--hover-fill|
--radius-*|--font-*|--control-min-height|--button-min-height|--space-*)`.
3. If the page re-implements a kit block, swap in the block from
   `apps/web/src/kit/blocks/` instead of styling by hand.
4. Keep explicit product choices: if the page intentionally pins a look, pin
   it the supported way (`data-theme="<pack>"` on the wrapper) rather than
   hardcoding values.
5. Verify the re-theme actually works: screenshot the page under at least two
   packs (e.g. Obsidian + Paper) and both `data-layout` variants if it's an
   app screen — light and dark must both be legible.
6. `pnpm check` green; update contract tests deliberately if the change alters
   a pinned behavior.
